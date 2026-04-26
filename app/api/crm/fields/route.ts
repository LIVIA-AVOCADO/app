import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function getTenantId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('users').select('tenant_id').eq('id', userId).single();
  return data?.tenant_id ?? null;
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantId = await getTenantId(supabase, authData.user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('contact_field_definitions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('display_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantId = await getTenantId(supabase, authData.user.id);
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await req.json();
  const { field_key, field_label, field_type, options, is_required, display_order } = body;

  if (!field_key?.trim() || !field_label?.trim() || !field_type) {
    return NextResponse.json({ error: 'field_key, field_label e field_type são obrigatórios' }, { status: 400 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('contact_field_definitions')
    .insert({
      tenant_id: tenantId,
      field_key: field_key.trim().toLowerCase().replace(/\s+/g, '_'),
      field_label: field_label.trim(),
      field_type,
      options: options ?? null,
      is_required: is_required ?? false,
      display_order: display_order ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
