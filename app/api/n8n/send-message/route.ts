/**
 * API Route: Send Message
 *
 * POST /api/n8n/send-message
 *
 * Fluxo:
 * 1. Valida auth + tenant
 * 2. Insere mensagem no Supabase com status='sent' (= "LIVIA recebeu")
 * 3. Retorna {id, status:'sent'} imediatamente — cliente confirma a mensagem otimista
 * 4. after(): envia via gateway /v2/send em background sem bloquear a resposta HTTP
 * 5. Sucesso → UPDATE external_message_id (= "canal confirmou entrega")
 *    Falha real → UPDATE status='failed' → Realtime avisa o cliente
 *    Timeout (30s) → mantém 'sent'; external_message_id fica nulo (órfão detectável)
 * 6. Pausa IA automaticamente se estava ativa
 *
 * Semântica de status (padrão de mercado — igual WhatsApp/Telegram):
 *   sent                        → ✓  LIVIA recebeu e salvou
 *   sent + external_message_id  → ✓✓ Canal confirmou entrega
 *   read                        → ✓✓ Destinatário leu
 *   failed                      → ✗  Falha confirmada no envio
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callN8nWebhook } from '@/lib/n8n/client';

const N8N_PAUSE_IA_WEBHOOK = process.env.N8N_PAUSE_IA_WEBHOOK!;
const GATEWAY_URL         = process.env.GATEWAY_URL; // https://livia-gw.online24por7.ai
const GATEWAY_V2_SEND_URL = GATEWAY_URL ? `${GATEWAY_URL}/v2/send` : undefined;
const GATEWAY_API_KEY     = process.env.GATEWAY_API_KEY;

export async function POST(request: NextRequest) {
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

    const contactId = conversation.contact_id;
    const channelId = conversation.channel_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iaActive  = (conversation as any).ia_active;

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

    // Insere mensagem como 'sent' (LIVIA recebeu)
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

    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert(messageData)
      .select('id')
      .single();

    if (insertError || !message) {
      console.error('[send-message] Error inserting message:', insertError);
      return NextResponse.json({ error: 'Erro ao salvar mensagem' }, { status: 500 });
    }

    // Atualiza timestamps da conversa e do contato (fire-and-forget)
    const now = new Date().toISOString();
    void Promise.all([
      supabase.from('conversations').update({ last_message_at: now, updated_at: now }).eq('id', conversationId),
      supabase.from('contacts').update({ last_interaction_at: now }).eq('id', contactId),
    ]);

    // Envio e pausa de IA rodam DEPOIS da resposta (after garante execução completa no Vercel)
    after(async () => {
      await sendViaGateway(message.id, channelId, contactId, content.trim(), quotedData, supabase);
      if (iaActive) {
        await pauseIAAsync(conversationId, tenantId, user.id, supabase);
      }
    });

    return NextResponse.json({ success: true, message: { id: message.id, status: 'sent' } });

  } catch (error) {
    console.error('[send-message] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Envio via Go Gateway /v2/send (provider-agnostic) ───────────────────────

async function sendViaGateway(
  messageId: string,
  channelId: string,
  contactId: string,
  content: string,
  quotedData: { externalId: string | null; content: string; fromMe: boolean } | null,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const msgId = messageId.slice(0, 8);
  try {
    if (!GATEWAY_V2_SEND_URL) {
      console.error(`[gateway] ❌ ${msgId}: GATEWAY_URL não configurado`);
      await updateMessageStatus(messageId, 'failed', null, supabase);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contact } = await (supabase as any)
      .from('contacts')
      .select('phone')
      .eq('id', contactId)
      .single();

    const to = contact?.phone ?? '';
    if (!to) {
      console.error(`[gateway] ❌ ${msgId}: número do contato não encontrado`);
      await updateMessageStatus(messageId, 'failed', null, supabase);
      return;
    }

    const payload: Record<string, unknown> = { channel_id: channelId, to, text: content };

    if (quotedData?.externalId) {
      payload.quoted_external_id = quotedData.externalId;
      payload.quoted_from_me     = quotedData.fromMe;
      payload.quoted_content     = quotedData.content;
    }

    console.error(`[gateway] 🚀 ${msgId} → channel ${channelId.slice(0, 8)}`);

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 30000);

    let res: Response;
    try {
      res = await fetch(GATEWAY_V2_SEND_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${GATEWAY_API_KEY ?? ''}`,
        },
        body:   JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        // Gateway não respondeu em 30s — não marca failed pois a mensagem
        // pode já ter sido entregue. O Realtime trará update se confirmado.
        console.error(`[gateway] ⏰ ${msgId}: timeout 30s — mantém status sent`);
      } else {
        console.error(`[gateway] 💥 ${msgId}:`, fetchErr);
        await updateMessageStatus(messageId, 'failed', null, supabase);
      }
      return;
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      console.error(`[gateway] ❌ ${msgId}: gateway ${res.status}`, text);
      await updateMessageStatus(messageId, 'failed', null, supabase);
      return;
    }

    // /v2/send retorna {"external_message_id":"wamid.xxx"} quando o canal suporta
    let externalId: string | null = null;
    try {
      const data = await res.json() as { external_message_id?: string };
      externalId = data?.external_message_id ?? null;
    } catch {
      // resposta sem body — external_id fica nulo
    }

    console.error(`[gateway] ✅ ${msgId}: sent, external_id=${externalId}`);
    await updateMessageStatus(messageId, 'sent', externalId, supabase);

  } catch (err) {
    console.error(`[gateway] 💥 ${msgId}:`, err);
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
