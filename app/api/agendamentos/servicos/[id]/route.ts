/**
 * GET    /api/agendamentos/servicos/[id]
 * PATCH  /api/agendamentos/servicos/[id]
 * DELETE /api/agendamentos/servicos/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceById, updateService, deleteService } from '@/lib/queries/scheduling';
import { z } from 'zod';

const updateSchema = z.object({
  name:                z.string().min(1).max(100).optional(),
  description:         z.string().optional().nullable(),
  durationMinutes:     z.number().int().positive().optional(),
  bufferBeforeMinutes: z.number().int().min(0).optional(),
  bufferAfterMinutes:  z.number().int().min(0).optional(),
  priceCents:          z.number().int().min(0).optional().nullable(),
  isActive:            z.boolean().optional(),
  metadata:            z.record(z.string(), z.unknown()).optional(),
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
    const service = await getServiceById(id, tenantId);
    if (!service) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ data: service });
  } catch (error) {
    console.error('Error in GET /api/agendamentos/servicos/[id]:', error);
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
    const service = await updateService(id, tenantId, {
      name:                 parsed.data.name,
      description:          parsed.data.description,
      duration_minutes:     parsed.data.durationMinutes,
      buffer_before_minutes: parsed.data.bufferBeforeMinutes,
      buffer_after_minutes:  parsed.data.bufferAfterMinutes,
      price_cents:          parsed.data.priceCents,
      is_active:            parsed.data.isActive,
      metadata:             parsed.data.metadata,
    });

    return NextResponse.json({ success: true, data: service });
  } catch (error) {
    console.error('Error in PATCH /api/agendamentos/servicos/[id]:', error);
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
    await deleteService(id, tenantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/agendamentos/servicos/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
