/**
 * API Route: Send Message
 *
 * POST /api/n8n/send-message
 *
 * Fluxo:
 * 1. Valida auth + tenant
 * 2. Insere mensagem no Supabase com status='pending'
 * 3. Roteia pelo provider do canal:
 *    - Evolution → Go Gateway /send (direto, sem n8n)
 *    - Meta / outros → n8n (caminho legado, preservado)
 * 4. Atualiza status para 'sent' ou 'failed'
 * 5. Pausa IA automaticamente se estava ativa
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callN8nWebhook } from '@/lib/n8n/client';

const N8N_SEND_MESSAGE_WEBHOOK = process.env.N8N_SEND_MESSAGE_WEBHOOK!;
const N8N_PAUSE_IA_WEBHOOK     = process.env.N8N_PAUSE_IA_WEBHOOK!;
const GATEWAY_SEND_URL         = process.env.GATEWAY_SEND_URL; // https://livia-gw.online24por7.ai/send
const GATEWAY_API_KEY          = process.env.GATEWAY_API_KEY;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { conversationId, content, tenantId, quotedMessageId } = body;

    if (!conversationId || !content || !tenantId) {
      return NextResponse.json(
        { error: 'conversationId, content e tenantId são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Busca conversa + valida tenant
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, tenant_id, contact_id, channel_id, ia_active')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    if (!conversation.contact_id || !conversation.channel_id) {
      return NextResponse.json({ error: 'Conversa incompleta (sem contact ou channel)' }, { status: 400 });
    }

    const contactId  = conversation.contact_id;
    const channelId  = conversation.channel_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iaActive   = (conversation as any).ia_active;

    // Dados da mensagem citada (reply)
    let quotedData: { externalId: string | null; content: string; fromMe: boolean } | null = null;
    if (quotedMessageId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: quotedMsg } = await (supabase as any)
        .from('messages')
        .select('external_message_id, content, sender_type')
        .eq('id', quotedMessageId)
        .single();
      if (quotedMsg) {
        quotedData = {
          externalId: quotedMsg.external_message_id ?? null,
          content:    quotedMsg.content ?? '',
          fromMe:     quotedMsg.sender_type !== 'customer',
        };
      }
    }

    // Insere mensagem como 'pending' e resolve canal em paralelo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageData: any = {
      conversation_id: conversationId,
      content:         content.trim(),
      sender_type:     'attendant',
      sender_user_id:  user.id,
      status:          'sent',
      timestamp:       new Date().toISOString(),
      ...(quotedMessageId ? { quoted_message_id: quotedMessageId } : {}),
    };

    const [{ data: message, error: insertError }, channelInfo] = await Promise.all([
      supabase.from('messages').insert(messageData).select('id').single(),
      resolveChannelInfo(supabase, channelId, tenantId),
    ]);

    if (insertError || !message) {
      console.error('[send-message] Error inserting message:', insertError);
      return NextResponse.json({ error: 'Erro ao salvar mensagem' }, { status: 500 });
    }

    console.error(`[send-message] ✅ DB insert ${Date.now() - startTime}ms (id: ${message.id.slice(0, 8)})`);

    // Atualiza timestamps da conversa e do contato (fire-and-forget)
    const now = new Date().toISOString();
    void Promise.all([
      supabase.from('conversations').update({ last_message_at: now, updated_at: now }).eq('id', conversationId),
      supabase.from('contacts').update({ last_interaction_at: now }).eq('id', contactId),
    ]);

    // Envio e pausa de IA rodam DEPOIS da resposta (after garante execução completa no Vercel)
    after(async () => {
      if (channelInfo?.isEvolution && GATEWAY_SEND_URL) {
        await sendViaGateway(message.id, channelInfo, contactId, content.trim(), quotedData, supabase);
      } else {
        await sendToN8nAsync(
          message.id, conversationId, content.trim(), tenantId,
          user.id, contactId, channelId, quotedData, supabase
        );
      }
      if (iaActive) {
        await pauseIAAsync(conversationId, tenantId, user.id, supabase);
      }
      console.error(`[send-message] ⏱️ after() concluído ${Date.now() - startTime}ms`);
    });

    console.error(`[send-message] ⏱️ Resposta em ${Date.now() - startTime}ms`);

    return NextResponse.json({ success: true, message: { id: message.id, status: 'sent' } });

  } catch (error) {
    console.error('[send-message] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Resolução do canal ───────────────────────────────────────────────────────

interface ChannelInfo {
  isEvolution:      boolean;
  evolutionBaseUrl: string;
  evolutionApiKey:  string;
  instanceName:     string;
}

async function resolveChannelInfo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  channelId: string,
  tenantId: string,
): Promise<ChannelInfo | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: channel } = await (supabase as any)
      .from('channels')
      .select('config_json, external_api_url, instance_company_name, provider_external_channel_id')
      .eq('id', channelId)
      .eq('tenant_id', tenantId)
      .single();

    if (!channel) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = channel.config_json as Record<string, any> | null;

    const evolutionBaseUrl = cfg?.evolution_api_url ?? channel.external_api_url ?? '';
    const evolutionApiKey  = cfg?.evolution_api_key ?? channel.provider_external_channel_id ?? '';
    const instanceName     = cfg?.instance_name ?? channel.instance_company_name ?? '';

    if (!evolutionBaseUrl || !instanceName) return null;

    return { isEvolution: true, evolutionBaseUrl, evolutionApiKey, instanceName };
  } catch {
    return null;
  }
}

// ─── Envio via Go Gateway (Evolution) ────────────────────────────────────────

async function sendViaGateway(
  messageId: string,
  channel: ChannelInfo,
  contactId: string,
  content: string,
  quotedData: { externalId: string | null; content: string; fromMe: boolean } | null,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const msgId = messageId.slice(0, 8);
  try {
    // Busca o telefone do contato
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contact } = await (supabase as any)
      .from('contacts')
      .select('external_identification_contact, phone')
      .eq('id', contactId)
      .single();

    const number = contact?.external_identification_contact ?? contact?.phone ?? '';
    if (!number) {
      console.error(`[gateway-send] ❌ ${msgId}: número do contato não encontrado`);
      await updateMessageStatus(messageId, 'failed', null, supabase);
      return;
    }

    const payload: Record<string, unknown> = {
      evolutionBaseUrl: channel.evolutionBaseUrl,
      evolutionApiKey:  channel.evolutionApiKey,
      instanceName:     channel.instanceName,
      number,
      text: content,
    };

    if (quotedData?.externalId) {
      payload.quotedExternalId = quotedData.externalId;
      payload.quotedFromMe     = quotedData.fromMe;
      payload.quotedContent    = quotedData.content;
    }

    console.error(`[gateway-send] 🚀 ${msgId} → ${channel.instanceName}`);

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(GATEWAY_SEND_URL!, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GATEWAY_API_KEY ?? ''}`,
      },
      body:   JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      console.error(`[gateway-send] ❌ ${msgId}: gateway ${res.status}`, text);
      await updateMessageStatus(messageId, 'failed', null, supabase);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any;
    const externalId = data?.key?.id ?? null;

    console.error(`[gateway-send] ✅ ${msgId}: sent, external_id=${externalId}`);
    await updateMessageStatus(messageId, 'sent', externalId, supabase);

  } catch (err) {
    console.error(`[gateway-send] 💥 ${msgId}:`, err);
    await updateMessageStatus(messageId, 'failed', null, supabase);
  }
}

// ─── Envio via n8n (Meta / caminho legado) ───────────────────────────────────

async function sendToN8nAsync(
  messageId: string, conversationId: string, content: string,
  tenantId: string, userId: string, contactId: string, channelId: string,
  quotedData: { externalId: string | null; content: string; fromMe: boolean } | null | undefined,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const msgId = messageId.slice(0, 8);
  try {
    console.error(`[n8n-async] 🚀 ${msgId} → n8n`);
    const result = await callN8nWebhook(
      N8N_SEND_MESSAGE_WEBHOOK,
      {
        messageId, conversationId, contactId, channelId, content, tenantId, userId,
        ...(quotedData ? {
          quotedExternalId: quotedData.externalId,
          quotedContent:    quotedData.content,
          quotedFromMe:     quotedData.fromMe,
        } : {}),
      },
      { timeout: 15000 }
    );
    if (!result.success) {
      const isTimeout = result.error?.includes('timeout');
      console.error(`[n8n-async] ❌ ${msgId}:`, result.error);
      if (!isTimeout) {
        await updateMessageStatus(messageId, 'failed', null, supabase);
      }
    }
  } catch (err) {
    console.error(`[n8n-async] 💥 ${msgId}:`, err);
    await updateMessageStatus(messageId, 'failed', null, supabase);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function updateMessageStatus(
  messageId: string,
  status: 'sent' | 'failed',
  externalMessageId: string | null,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: any = { status };
    if (externalMessageId) update.external_message_id = externalMessageId;
    await supabase.from('messages').update(update).eq('id', messageId);
  } catch (err) {
    console.error('[send-message] Error updating message status:', err);
  }
}

async function pauseIAAsync(
  conversationId: string, tenantId: string, userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  try {
    const result = await callN8nWebhook(
      N8N_PAUSE_IA_WEBHOOK,
      { conversationId, tenantId, userId, reason: 'Pausado automaticamente - Atendente assumiu a conversa' },
      { timeout: 5000 }
    );
    if (!result.success) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('conversations').update({ ia_active: false, pause_notes: 'Pausado automaticamente - Atendente assumiu a conversa' } as any).eq('id', conversationId);
    }
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('conversations').update({ ia_active: false } as any).eq('id', conversationId);
  }
}
