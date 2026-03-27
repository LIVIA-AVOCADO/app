/**
 * API Route: Follow Up de Conversa
 *
 * POST /api/conversations/followup  — cria follow-up e pausa IA se ativa
 * GET  /api/conversations/followup?conversationId=X  — retorna follow-up ativo
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createSchema = z.object({
  conversationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  message: z.string().min(1).nullable().optional(),
  aiGenerate: z.boolean(),
  cancelOnReply: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { conversationId, tenantId, scheduledAt, message, aiGenerate, cancelOnReply } = parsed.data;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Valida que a conversa pertence ao tenant
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, tenant_id, ia_active')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    }

    // Cria o follow-up
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: followup, error: insertError } = await (supabase as any)
      .from('conversation_followups')
      .insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        scheduled_at: scheduledAt,
        message: aiGenerate ? null : (message ?? null),
        ai_generate: aiGenerate,
        cancel_on_reply: cancelOnReply,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      // Unique constraint: já existe follow-up ativo
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe um follow-up ativo para esta conversa' },
          { status: 409 }
        );
      }
      console.error('[followup] Error creating followup:', insertError);
      return NextResponse.json({ error: 'Erro ao criar follow-up' }, { status: 500 });
    }

    // Se IA estiver ativa, pausar automaticamente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((conversation as any).ia_active) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('conversations')
        .update({
          ia_active: false,
          pause_notes: 'Pausado automaticamente — Follow up agendado',
        })
        .eq('id', conversationId);
    }

    return NextResponse.json({ success: true, followup });
  } catch (error) {
    console.error('[followup] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId é obrigatório' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: followup } = await (supabase as any)
      .from('conversation_followups')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('is_done', false)
      .maybeSingle();

    return NextResponse.json({ followup: followup ?? null });
  } catch (error) {
    console.error('[followup GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
