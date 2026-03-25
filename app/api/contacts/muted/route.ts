/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * API Route: List Muted Contacts
 *
 * Lista todos os contatos silenciados do tenant.
 * GET /api/contacts/muted
 *
 * Retorna contatos com is_muted=true, incluindo quem silenciou e quando.
 * Faz duas queries separadas para evitar join cross-schema (muted_by → auth.users).
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

    // Query 1: contatos silenciados (sem join cross-schema)
    const { data: contacts, error: contactsError } = await (supabase as any)
      .from('contacts')
      .select('id, name, phone, email, is_muted, muted_at, muted_by')
      .eq('tenant_id', tenantId)
      .eq('is_muted', true)
      .order('muted_at', { ascending: false });

    if (contactsError) throw contactsError;
    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ contacts: [] });
    }

    // Query 2: nomes dos usuários que silenciaram (public.users, mesmos IDs do auth.users)
    const mutedByIds = [...new Set(
      contacts.map((c: any) => c.muted_by).filter(Boolean)
    )] as string[];

    let usersMap: Record<string, string | null> = {};
    if (mutedByIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', mutedByIds);
      usersMap = Object.fromEntries(
        (users || []).map((u: any) => [u.id, u.full_name])
      );
    }

    // Combina resultados
    const result = contacts.map((c: any) => ({
      ...c,
      mutedByUser: c.muted_by
        ? { id: c.muted_by, full_name: usersMap[c.muted_by] ?? null }
        : null,
    }));

    return NextResponse.json({ contacts: result });

  } catch (error) {
    console.error('[contacts/muted] ❌ Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
