import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/automation/rules?tenantId=xxx
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('ura_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

// POST /api/automation/rules
// Body: { tenantId, name, priority, conditions, action_type, action_config }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { tenantId, name, priority, conditions, action_type, action_config } = body as {
    tenantId: string;
    name: string;
    priority?: number;
    conditions?: unknown[];
    action_type: string;
    action_config: Record<string, unknown>;
  };

  if (!tenantId || !name?.trim() || !action_type) {
    return NextResponse.json({ error: 'tenantId, name e action_type são obrigatórios' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('ura_rules')
    .insert({
      tenant_id: tenantId,
      name: name.trim(),
      priority: priority ?? 0,
      conditions: conditions ?? [],
      action_type,
      action_config: action_config ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}
