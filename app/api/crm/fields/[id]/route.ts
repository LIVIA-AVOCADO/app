import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData } = await supabase.from('users').select('tenant_id').eq('id', authData.user.id).single();
  if (!userData?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await req.json();
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('contact_field_definitions')
    .update(body)
    .eq('id', id)
    .eq('tenant_id', userData.tenant_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData } = await supabase.from('users').select('tenant_id').eq('id', authData.user.id).single();
  if (!userData?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('contact_field_definitions')
    .delete()
    .eq('id', id)
    .eq('tenant_id', userData.tenant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
