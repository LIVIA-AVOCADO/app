import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .single();

  if (!userData?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await req.json();
  const { conversation_id, deal_value, deal_currency } = body;

  if (!conversation_id) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 });

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await admin
    .from('conversations')
    .update({
      deal_value: deal_value != null ? Number(deal_value) : null,
      deal_currency: deal_currency ?? 'BRL',
    } as any)
    .eq('id', conversation_id)
    .eq('tenant_id', userData.tenant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
