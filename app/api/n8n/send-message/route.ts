/**
 * API Route: Send Message
 *
 * NOVA ABORDAGEM: Salvar no banco PRIMEIRO, depois chamar n8n de forma assíncrona
 * POST /api/n8n/send-message
 *
 * Fluxo:
 * 1. Validar auth + tenant
 * 2. Inserir mensagem no Supabase com status='pending'
 * 3. Retornar sucesso imediatamente (Realtime atualiza UI)
 * 4. Chamar n8n em background (atualiza status para 'sent' ou 'failed')
 * 5. PAUSAR IA automaticamente quando atendente envia mensagem
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callN8nWebhook } from '@/lib/n8n/client';

const N8N_SEND_MESSAGE_WEBHOOK = process.env.N8N_SEND_MESSAGE_WEBHOOK!;
const N8N_PAUSE_IA_WEBHOOK = process.env.N8N_PAUSE_IA_WEBHOOK!;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Parse payload primeiro (validação rápida)
    const body = await request.json();
    const { conversationId, content, tenantId, quotedMessageId } = body;

    if (!conversationId || !content || !tenantId) {
      return NextResponse.json(
        { error: 'conversationId, content e tenantId são obrigatórios' },
        { status: 400 }
      );
    }

    // 2. Autenticação + Validação em PARALELO (query única otimizada)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. QUERY ÚNICA: Buscar conversa + validar tenant + buscar ia_active
    // Isso substitui 2 queries separadas (users + conversations)
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, tenant_id, contact_id, channel_id, ia_active')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conversation) {
      console.error('[send-message] Conversation not found:', convError);
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    if (!conversation.contact_id || !conversation.channel_id) {
      console.error('[send-message] Incomplete conversation data:', conversation);
      return NextResponse.json({ error: 'Conversa incompleta (sem contact ou channel)' }, { status: 400 });
    }

    // Garantir tipos não-null após validação
    const contactId = conversation.contact_id;
    const channelId = conversation.channel_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iaActive = (conversation as any).ia_active;

    // 4. Buscar dados da mensagem citada (se houver reply)
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
          content: quotedMsg.content ?? '',
          fromMe: quotedMsg.sender_type !== 'customer',
        };
      }
    }

    // 5. Inserir mensagem no banco ANTES de chamar n8n
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageData: any = {
      conversation_id: conversationId,
      content: content.trim(),
      sender_type: 'attendant',
      sender_user_id: user.id,
      status: 'pending', // N8N vai atualizar para sent/failed/read
      timestamp: new Date().toISOString(),
      ...(quotedMessageId ? { quoted_message_id: quotedMessageId } : {}),
    };

    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert(messageData)
      .select('id')
      .single();

    if (insertError || !message) {
      console.error('[send-message] Error inserting message:', insertError);
      return NextResponse.json(
        { error: 'Erro ao salvar mensagem' },
        { status: 500 }
      );
    }

    const dbTime = Date.now() - startTime;
    console.error(`[send-message] ✅ DB operations took ${dbTime}ms (message: ${message.id.slice(0, 8)})`);

    // 5. Chamar n8n com AWAIT
    // IMPORTANTE: Em Vercel (serverless), Promises sem AWAIT podem não executar
    // porque o contexto é terminado após retornar a response.
    // SOLUÇÃO: Usar AWAIT para garantir execução, mas com timeout curto
    console.error(`[send-message] 🚀 Starting n8n call for message ${message.id.slice(0, 8)}...`);

    // AWAIT da chamada n8n para garantir que execute em ambiente serverless
    await sendToN8nAsync(
      message.id,
      conversationId,
      content.trim(),
      tenantId,
      user.id,
      contactId,
      channelId,
      quotedData
    );

    // 6. Pausar IA automaticamente quando atendente envia mensagem
    // Só pausa se a IA estiver ativa
    if (iaActive) {
      console.error(`[send-message] 🤖 IA is active, pausing automatically...`);
      await pauseIAAsync(conversationId, tenantId, user.id, supabase);
    } else {
      console.error(`[send-message] 🤖 IA already paused, skipping...`);
    }

    // 7. Retornar sucesso
    // Realtime do Supabase já notificou o cliente sobre a nova mensagem
    const totalTime = Date.now() - startTime;
    console.error(`[send-message] ⏱️ Total response time: ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        status: 'pending',
      },
    });

  } catch (error) {
    console.error('[send-message] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Função auxiliar para chamar n8n em background
 * N8N é responsável por atualizar o status da mensagem
 */
async function sendToN8nAsync(
  messageId: string,
  conversationId: string,
  content: string,
  tenantId: string,
  userId: string,
  contactId: string,
  channelId: string,
  quotedData?: { externalId: string | null; content: string; fromMe: boolean } | null
) {
  const n8nStartTime = Date.now();
  const msgId = messageId.slice(0, 8);

  try {
    console.error(`[n8n-async] 📞 Calling n8n webhook for message ${msgId}...`);
    console.error(`[n8n-async] 🔗 Webhook: ${process.env.N8N_BASE_URL}${N8N_SEND_MESSAGE_WEBHOOK}`);

    // Timeout de 5s para n8n (reduzido de 10s padrão)
    const result = await callN8nWebhook(
      N8N_SEND_MESSAGE_WEBHOOK,
      {
        messageId, // n8n usará para atualizar status
        conversationId,
        contactId,
        channelId,
        content,
        tenantId,
        userId,
        // Dados da mensagem citada (reply) — usados pelo N8N para montar
        // quoted.key (Evolution API) ou context.message_id (WhatsApp Cloud API)
        ...(quotedData ? {
          quotedExternalId: quotedData.externalId,
          quotedContent: quotedData.content,
          quotedFromMe: quotedData.fromMe,
        } : {}),
      },
      { timeout: 5000 } // 5 segundos máximo
    );

    const n8nTime = Date.now() - n8nStartTime;

    if (result.success) {
      console.error(`[n8n-async] ✅ N8N responded successfully in ${n8nTime}ms`);
      console.error(`[n8n-async] 📊 Response data:`, JSON.stringify(result.data));
      // N8N é responsável por atualizar status='sent' e external_message_id
    } else {
      console.error(`[n8n-async] ❌ N8N failed after ${n8nTime}ms:`, result.error);
      // Fallback: atualizar status manualmente apenas se n8n não conseguir
      console.error(`[n8n-async] 🔄 Updating message status to 'failed'...`);
      await updateMessageStatus(messageId, 'failed');
    }
  } catch (error) {
    const n8nTime = Date.now() - n8nStartTime;
    console.error(`[n8n-async] 💥 Exception after ${n8nTime}ms:`, error);
    console.error(`[n8n-async] 🔄 Attempting to update message status to 'failed'...`);
    await updateMessageStatus(messageId, 'failed');
  }
}

/**
 * Atualiza status da mensagem (fallback se n8n falhar)
 */
async function updateMessageStatus(messageId: string, status: 'sent' | 'failed') {
  try {
    const supabase = await createClient();
    await supabase
      .from('messages')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ status } as any) // Type assertion temporário até regenerar types do Supabase
      .eq('id', messageId);
  } catch (error) {
    console.error('Error updating message status:', error);
  }
}

/**
 * Pausa IA automaticamente quando atendente envia mensagem
 */
async function pauseIAAsync(
  conversationId: string,
  tenantId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const pauseStartTime = Date.now();
  const convId = conversationId.slice(0, 8);

  try {
    console.error(`[pause-ia-auto] 📞 Calling n8n webhook for conversation ${convId}...`);

    // Chamar webhook n8n para pausar IA
    const result = await callN8nWebhook(
      N8N_PAUSE_IA_WEBHOOK,
      {
        conversationId,
        tenantId,
        userId,
        reason: 'Pausado automaticamente - Atendente assumiu a conversa',
      },
      { timeout: 5000 } // 5 segundos timeout
    );

    const pauseTime = Date.now() - pauseStartTime;

    if (result.success) {
      console.error(`[pause-ia-auto] ✅ IA paused successfully in ${pauseTime}ms`);
    } else {
      console.error(`[pause-ia-auto] ⚠️ N8N failed after ${pauseTime}ms:`, result.error);

      // Fallback: Fazer UPDATE direto no banco
      console.error(`[pause-ia-auto] 🔄 Using fallback: direct database update`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        ia_active: false,
        pause_notes: 'Pausado automaticamente - Atendente assumiu a conversa',
      };

      const { error: updateError } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId);

      if (updateError) {
        console.error(`[pause-ia-auto] ❌ Fallback failed:`, updateError);
      } else {
        console.error(`[pause-ia-auto] ✅ Fallback succeeded`);
      }
    }
  } catch (error) {
    const pauseTime = Date.now() - pauseStartTime;
    console.error(`[pause-ia-auto] 💥 Exception after ${pauseTime}ms:`, error);

    // Tentar fallback mesmo em caso de exceção
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        ia_active: false,
        pause_notes: 'Pausado automaticamente - Atendente assumiu a conversa',
      };

      await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId);

      console.error(`[pause-ia-auto] ✅ Fallback succeeded after exception`);
    } catch (fallbackError) {
      console.error(`[pause-ia-auto] ❌ Fallback also failed:`, fallbackError);
    }
  }
}
