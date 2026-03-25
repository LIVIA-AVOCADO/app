/**
 * API Route: List Muted Contacts
 *
 * Lista todos os contatos silenciados do tenant.
 * GET /api/contacts/muted
 *
 * Retorna contatos com is_muted=true, incluindo quem silenciou e quando.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 });
    }

    // Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Valida que o usuário pertence ao tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Busca contatos silenciados com nome de quem silenciou
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contacts, error } = await (supabase as any)
      .from('contacts')
      .select(`
        id,
        name,
        phone,
        email,
        is_muted,
        muted_at,
        muted_by,
        mutedByUser:users!contacts_muted_by_fkey(
          id,
          full_name
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('is_muted', true)
      .order('muted_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ contacts: contacts ?? [] });

  } catch (error) {
    console.error('[contacts/muted] ❌ Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
