/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * API Route: Mute / Unmute Contact
 *
 * Silencia ou remove o silêncio de um contato.
 * POST /api/contacts/[id]/mute
 *
 * Payload: { action: "mute" | "unmute", tenantId: string }
 *
 * Fluxo mute:
 * 1. Auth + validação de tenant (igual todas as outras rotas)
 * 2. UPDATE contacts SET is_muted=true, muted_at=now(), muted_by=user.id
 * 3. UPDATE conversations SET ia_active=false para todas as conversas abertas do contato
 *
 * Fluxo unmute:
 * 1. Auth + validação de tenant
 * 2. UPDATE contacts SET is_muted=false, muted_at=null, muted_by=null
 * (IA não é reativada automaticamente — decisão explícita do atendente)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contactId = params.id;

    const body = await request.json();
    const { action, tenantId } = body;

    if (!contactId || !tenantId || !action) {
      return NextResponse.json(
        { error: 'contactId, tenantId e action são obrigatórios' },
        { status: 400 }
      );
    }

    if (action !== 'mute' && action !== 'unmute') {
      return NextResponse.json(
        { error: 'action deve ser "mute" ou "unmute"' },
        { status: 400 }
      );
    }

    // 1. Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Valida que o usuário pertence ao tenant (padrão de todas as rotas)
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const userTenantId = (userData as { tenant_id?: string })?.tenant_id;

    if (!userTenantId || userTenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Busca contato e valida que pertence ao tenant
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, tenant_id')
      .eq('id', contactId)
      .eq('tenant_id', tenantId)
      .single();

    if (contactError || !contact) {
      console.error('[mute-contact] Contato não encontrado:', contactError);
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    if (action === 'mute') {
      // 4a. Silenciar contato
      const { error: muteError } = await (supabase as any)
        .from('contacts')
        .update({
          is_muted: true,
          muted_at: new Date().toISOString(),
          muted_by: user.id,
        })
        .eq('id', contactId)
        .eq('tenant_id', tenantId);

      if (muteError) {
        console.error('[mute-contact] Erro ao silenciar:', muteError);
        return NextResponse.json(
          { error: 'Erro ao silenciar contato', details: muteError.message },
          { status: 500 }
        );
      }

      // 5a. Pausar IA em todas as conversas abertas do contato
      const { data: updatedConversations, error: convError } = await (supabase as any)
        .from('conversations')
        .update({
          ia_active: false,
          pause_notes: 'IA pausada automaticamente — contato silenciado pelo atendente',
        })
        .eq('contact_id', contactId)
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .eq('ia_active', true)
        .select('id');

      if (convError) {
        console.error('[mute-contact] Erro ao pausar IA nas conversas:', convError);
        // Não falha — o mute já foi feito com sucesso
      }

      return NextResponse.json({
        success: true,
        affected_conversations_count: updatedConversations?.length ?? 0,
      });
    }

    // action === 'unmute'
    const { error: unmuteError } = await (supabase as any)
      .from('contacts')
      .update({
        is_muted: false,
        muted_at: null,
        muted_by: null,
      })
      .eq('id', contactId)
      .eq('tenant_id', tenantId);

    if (unmuteError) {
      console.error('[mute-contact] Erro ao remover silêncio:', unmuteError);
      return NextResponse.json(
        { error: 'Erro ao remover silêncio', details: unmuteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[mute-contact] ❌ Unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
