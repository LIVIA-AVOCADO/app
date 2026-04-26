import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface Params {
  params: Promise<{ id: string }>;
}

// PATCH — upsert um ou mais valores de campos customizados
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: contactId } = await params;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .single();

  if (!userData?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  // Verify contact belongs to tenant
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('tenant_id', userData.tenant_id)
    .single();

  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  const body = await req.json();
  // body: { values: Record<string, string | null> }
  const { values } = body as { values: Record<string, string | null> };

  if (!values || typeof values !== 'object') {
    return NextResponse.json({ error: 'values object required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const upserts = Object.entries(values).map(([field_key, value]) => ({
    contact_id: contactId,
    tenant_id: userData.tenant_id,
    field_key,
    value: value ?? null,
    updated_at: new Date().toISOString(),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('contact_field_values')
    .upsert(upserts, { onConflict: 'contact_id,field_key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
