/**
 * API Route: Mute / Unmute Contact
 *
 * Silencia ou remove o silêncio de um contato.
 * POST /api/contacts/[id]/mute
 *
 * Payload: { action: "mute" | "unmute", tenantId: string }
 *
 * Fluxo mute:
 * 1. Auth + validação de tenant
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
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

    // Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Busca contato e valida tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contact, error: contactError } = await (supabase as any)
      .from('contacts')
      .select('id, tenant_id, is_muted')
      .eq('id', contactId)
      .eq('tenant_id', tenantId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    if (action === 'mute') {
      if (contact.is_muted) {
        return NextResponse.json({ error: 'Contato já está silenciado' }, { status: 400 });
      }

      // Silenciar contato
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedContact, error: muteError } = await (supabase as any)
        .from('contacts')
        .update({
          is_muted: true,
          muted_at: new Date().toISOString(),
          muted_by: user.id,
        })
        .eq('id', contactId)
        .select()
        .single();

      if (muteError) throw muteError;

      // Pausar IA em todas as conversas abertas do contato
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // Não falha o request — o mute do contato já foi feito
      }

      return NextResponse.json({
        success: true,
        contact: updatedContact,
        affected_conversations_count: updatedConversations?.length ?? 0,
      });
    }

    // action === 'unmute'
    if (!contact.is_muted) {
      return NextResponse.json({ error: 'Contato não está silenciado' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedContact, error: unmuteError } = await (supabase as any)
      .from('contacts')
      .update({
        is_muted: false,
        muted_at: null,
        muted_by: null,
      })
      .eq('id', contactId)
      .select()
      .single();

    if (unmuteError) throw unmuteError;

    return NextResponse.json({
      success: true,
      contact: updatedContact,
    });

  } catch (error) {
    console.error('[mute-contact] ❌ Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
