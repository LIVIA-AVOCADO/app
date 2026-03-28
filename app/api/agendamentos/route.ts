/**
 * GET  /api/agendamentos — lista agendamentos com filtros e paginação
 * POST /api/agendamentos — cria hold de agendamento
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppointments, holdAppointment } from '@/lib/queries/scheduling';
import { z } from 'zod';

const holdSchema = z.object({
  tenantId:             z.string().uuid(),
  contactId:            z.string().uuid(),
  serviceIds:           z.array(z.string().uuid()).min(1, 'Selecione ao menos um serviço'),
  startAt:              z.string().min(1, 'Data/hora é obrigatória'),
  unitId:               z.string().uuid().optional().nullable(),
  preferredResourceId:  z.string().uuid().optional().nullable(),
  source:               z.enum(['manual', 'ai', 'api']).optional(),
  holdMinutes:          z.number().int().positive().optional().nullable(),
  notes:                z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId é obrigatório' }, { status: 400 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if ((userData as { tenant_id?: string })?.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await getAppointments(tenantId, {
      status:     searchParams.get('status') as never ?? undefined,
      from:       searchParams.get('from')   ?? undefined,
      to:         searchParams.get('to')     ?? undefined,
      unit_id:    searchParams.get('unitId') ?? undefined,
      resource_id: searchParams.get('resourceId') ?? undefined,
      limit:      searchParams.get('limit')  ? Number(searchParams.get('limit'))  : undefined,
      offset:     searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/agendamentos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = holdSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) },
        { status: 400 }
      );
    }

    const { tenantId, contactId, serviceIds, startAt, unitId, preferredResourceId, source, holdMinutes, notes } = parsed.data;

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if ((userData as { tenant_id?: string })?.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await holdAppointment({
      tenant_id:            tenantId,
      contact_id:           contactId,
      service_ids:          serviceIds,
      start_at:             startAt,
      unit_id:              unitId,
      preferred_resource_id: preferredResourceId,
      source:               source ?? 'manual',
      hold_minutes:         holdMinutes,
      created_by_user_id:   user.id,
      notes,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/agendamentos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
