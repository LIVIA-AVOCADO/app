/**
 * GET  /api/agendamentos/unidades — lista unidades
 * POST /api/agendamentos/unidades — cria unidade
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUnits, createUnit } from '@/lib/queries/scheduling';
import { z } from 'zod';

const createSchema = z.object({
  tenantId:    z.string().uuid(),
  name:        z.string().min(1, 'Nome é obrigatório').max(100),
  addressJson: z.record(z.string(), z.unknown()).optional(),
  timezone:    z.string().optional(),
});

async function resolveTenantId(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from('users').select('tenant_id').eq('id', userId).single();
  return (data as { tenant_id?: string })?.tenant_id ?? null;
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = await resolveTenantId(user.id, supabase);
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const data = await getUnits(tenantId);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/agendamentos/unidades:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) },
        { status: 400 }
      );
    }

    const tenantId = await resolveTenantId(user.id, supabase);
    if (!tenantId || tenantId !== parsed.data.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const unit = await createUnit({
      tenant_id:    tenantId,
      name:         parsed.data.name,
      address_json: parsed.data.addressJson ?? {},
      timezone:     parsed.data.timezone ?? 'America/Fortaleza',
    });

    return NextResponse.json({ success: true, data: unit }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/agendamentos/unidades:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
