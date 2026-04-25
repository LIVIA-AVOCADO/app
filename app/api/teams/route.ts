import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/teams?tenantId=xxx
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('teams')
    .select('id, name, description, color, is_active, created_at, team_members(count)')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teams: data ?? [] });
}

// POST /api/teams
// Body: { tenantId, name, description?, color? }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { tenantId, name, description, color } = body as {
    tenantId: string;
    name: string;
    description?: string;
    color?: string;
  };

  if (!tenantId || !name?.trim()) {
    return NextResponse.json({ error: 'tenantId e name são obrigatórios' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('teams')
    .insert({
      tenant_id: tenantId,
      name: name.trim(),
      description: description?.trim() || null,
      color: color ?? '#6366f1',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data }, { status: 201 });
}
