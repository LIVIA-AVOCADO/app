/**
 * GET /api/contacts/search — busca contatos por nome ou telefone
 *
 * Query params:
 *   tenantId  — uuid (obrigatório)
 *   search    — texto a buscar em name ou phone_number
 *   limit     — número máximo de resultados (default: 10)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = (userData as { tenant_id?: string })?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const reqTenantId = searchParams.get('tenantId');
    if (reqTenantId && reqTenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const search = searchParams.get('search')?.trim() ?? '';
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);

    if (search.length < 2) {
      return NextResponse.json({ data: [] });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('contacts')
      .select('id, name, phone_number')
      .eq('tenant_id', tenantId)
      .or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`)
      .order('name')
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error('Error in GET /api/contacts/search:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
