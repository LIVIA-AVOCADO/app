/**
 * GET  /api/agendamentos/disponibilidade — janelas e exceções de disponibilidade
 * POST /api/agendamentos/disponibilidade — cria janela ou exceção
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAvailabilityWindows,
  getAvailabilityExceptions,
  upsertAvailabilityWindow,
  upsertAvailabilityException,
  deleteAvailabilityWindow,
  deleteAvailabilityException,
} from '@/lib/queries/scheduling';
import { z } from 'zod';

const windowSchema = z.object({
  type:       z.literal('window'),
  tenantId:   z.string().uuid(),
  resourceId: z.string().uuid(),
  dayOfWeek:  z.number().int().min(0).max(6),
  startTime:  z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  endTime:    z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  isActive:   z.boolean().optional(),
});

const exceptionSchema = z.object({
  type:          z.literal('exception'),
  tenantId:      z.string().uuid(),
  resourceId:    z.string().uuid().optional().nullable(),
  unitId:        z.string().uuid().optional().nullable(),
  exceptionType: z.enum(['block', 'extra_open']),
  startAt:       z.string().min(1),
  endAt:         z.string().min(1),
  reason:        z.string().optional().nullable(),
});

const deleteSchema = z.object({
  type: z.enum(['window', 'exception']),
  id:   z.string().uuid(),
});

const createSchema = z.discriminatedUnion('type', [windowSchema, exceptionSchema]);

async function resolveTenantId(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from('users').select('tenant_id').eq('id', userId).single();
  return (data as { tenant_id?: string })?.tenant_id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = await resolveTenantId(user.id, supabase);
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId') ?? undefined;

    const [windows, exceptions] = await Promise.all([
      resourceId ? getAvailabilityWindows(resourceId) : Promise.resolve([]),
      getAvailabilityExceptions(tenantId, {
        resourceId,
        unitId: searchParams.get('unitId') ?? undefined,
      }),
    ]);

    return NextResponse.json({ data: { windows, exceptions } });
  } catch (error) {
    console.error('Error in GET /api/agendamentos/disponibilidade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = await resolveTenantId(user.id, supabase);
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) },
        { status: 400 }
      );
    }

    if (parsed.data.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (parsed.data.type === 'window') {
      const window = await upsertAvailabilityWindow({
        tenant_id:  tenantId,
        resource_id: parsed.data.resourceId,
        day_of_week: parsed.data.dayOfWeek,
        start_time:  parsed.data.startTime,
        end_time:    parsed.data.endTime,
        is_active:   parsed.data.isActive ?? true,
      });
      return NextResponse.json({ success: true, data: window }, { status: 201 });
    }

    const exception = await upsertAvailabilityException({
      tenant_id:      tenantId,
      resource_id:    parsed.data.resourceId ?? null,
      unit_id:        parsed.data.unitId ?? null,
      exception_type: parsed.data.exceptionType,
      start_at:       parsed.data.startAt,
      end_at:         parsed.data.endAt,
      reason:         parsed.data.reason ?? null,
    });
    return NextResponse.json({ success: true, data: exception }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/agendamentos/disponibilidade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = await resolveTenantId(user.id, supabase);
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    if (parsed.data.type === 'window') {
      await deleteAvailabilityWindow(parsed.data.id, tenantId);
    } else {
      await deleteAvailabilityException(parsed.data.id, tenantId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/agendamentos/disponibilidade:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
