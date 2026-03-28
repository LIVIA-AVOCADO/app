/**
 * GET /api/agendamentos/agenda — retorna agenda do dia via sched_get_agenda
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAgenda } from '@/lib/queries/scheduling';
import type { AppointmentStatus } from '@/types/scheduling';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const date     = searchParams.get('date');

    if (!tenantId || !date) {
      return NextResponse.json({ error: 'tenantId e date são obrigatórios' }, { status: 400 });
    }

    const { data: userData } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if ((userData as { tenant_id?: string })?.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const statusesParam = searchParams.getAll('status') as AppointmentStatus[];
    const result = await getAgenda({
      tenant_id:   tenantId,
      date,
      unit_id:     searchParams.get('unitId')     ?? null,
      resource_id: searchParams.get('resourceId') ?? null,
      service_id:  searchParams.get('serviceId')  ?? null,
      statuses:    statusesParam.length ? statusesParam : undefined,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error in GET /api/agendamentos/agenda:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
