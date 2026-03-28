/**
 * POST /api/agendamentos/[id]/confirmar — confirma agendamento + dispara n8n
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { confirmAppointment, getAppointmentById, getSettings } from '@/lib/queries/scheduling';
import { triggerSchedulingAutomation } from '@/lib/utils/scheduling-webhooks';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    const tenantId = (userData as { tenant_id?: string })?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const appointment = await getAppointmentById(id, tenantId);
    if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const result = await confirmAppointment(id, body.notes ?? null);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    // Busca automation_config para incluir no payload n8n
    const settings = await getSettings(tenantId);

    triggerSchedulingAutomation({
      event:          'scheduling.appointment.confirmed',
      tenant_id:      tenantId,
      appointment_id: id,
      contact: {
        id:    appointment.contact.id,
        name:  appointment.contact.name,
        phone: appointment.contact.phone ?? null,
      },
      appointment: {
        start_at:  appointment.start_at,
        end_at:    appointment.end_at,
        unit_id:   appointment.unit_id,
        services:  appointment.services.map((s) => ({ service_id: s.id, name: s.name })),
        resources: appointment.resources.map((r) => ({ resource_id: r.id, name: r.name, type: r.resource_type })),
      },
      automation_config: settings?.automation_config ?? {},
    }).catch(console.error);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in POST /api/agendamentos/[id]/confirmar:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
