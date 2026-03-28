/**
 * GET    /api/agendamentos/unidades/[id]
 * PATCH  /api/agendamentos/unidades/[id]
 * DELETE /api/agendamentos/unidades/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUnitById, updateUnit, deleteUnit } from '@/lib/queries/scheduling';
import { z } from 'zod';

const updateSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  addressJson: z.record(z.string(), z.unknown()).optional(),
  timezone:    z.string().optional(),
  isActive:    z.boolean().optional(),
});

async function resolveTenantId(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from('users').select('tenant_id').eq('id', userId).single();
  return (data as { tenant_id?: string })?.tenant_id ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = await resolveTenantId(user.id, supabase);
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const unit = await getUnitById(id, tenantId);
    if (!unit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ data: unit });
  } catch (error) {
    console.error('Error in GET /api/agendamentos/unidades/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = await resolveTenantId(user.id, supabase);
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const { id } = await params;
    const unit = await updateUnit(id, tenantId, {
      name:         parsed.data.name,
      address_json: parsed.data.addressJson,
      timezone:     parsed.data.timezone,
      is_active:    parsed.data.isActive,
    });

    return NextResponse.json({ success: true, data: unit });
  } catch (error) {
    console.error('Error in PATCH /api/agendamentos/unidades/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = await resolveTenantId(user.id, supabase);
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await deleteUnit(id, tenantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/agendamentos/unidades/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
