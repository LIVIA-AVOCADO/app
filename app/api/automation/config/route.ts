import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/automation/config?tenantId=xxx
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('ura_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}

// PUT /api/automation/config
// Body: { tenantId, mode, business_hours, outside_hours_action, outside_hours_message }
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { tenantId, mode, business_hours, outside_hours_action, outside_hours_message } = body as {
    tenantId: string;
    mode?: string;
    business_hours?: Record<string, unknown>;
    outside_hours_action?: string;
    outside_hours_message?: string;
  };

  if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 });

  const payload: Record<string, unknown> = { tenant_id: tenantId };
  if (mode !== undefined) payload.mode = mode;
  if (business_hours !== undefined) payload.business_hours = business_hours;
  if (outside_hours_action !== undefined) payload.outside_hours_action = outside_hours_action;
  if (outside_hours_message !== undefined) payload.outside_hours_message = outside_hours_message || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('ura_configs')
    .upsert(payload, { onConflict: 'tenant_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
