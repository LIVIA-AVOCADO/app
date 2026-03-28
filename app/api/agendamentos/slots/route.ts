/**
 * GET /api/agendamentos/slots — retorna horários disponíveis via sched_find_slots
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findSlots } from '@/lib/queries/scheduling';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tenantId   = searchParams.get('tenantId');
    const serviceIds = searchParams.getAll('serviceId');
    const dateFrom   = searchParams.get('dateFrom');
    const dateTo     = searchParams.get('dateTo');

    if (!tenantId || !serviceIds.length || !dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'tenantId, serviceId(s), dateFrom e dateTo são obrigatórios' },
        { status: 400 }
      );
    }

    const { data: userData } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if ((userData as { tenant_id?: string })?.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await findSlots({
      tenant_id:             tenantId,
      service_ids:           serviceIds,
      date_from:             dateFrom,
      date_to:               dateTo,
      unit_id:               searchParams.get('unitId') ?? null,
      preferred_resource_id: searchParams.get('preferredResourceId') ?? null,
      allow_any_resource:    searchParams.get('allowAnyResource') !== 'false',
      time_from:             searchParams.get('timeFrom') ?? null,
      time_to:               searchParams.get('timeTo')   ?? null,
      limit:                 searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error in GET /api/agendamentos/slots:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
