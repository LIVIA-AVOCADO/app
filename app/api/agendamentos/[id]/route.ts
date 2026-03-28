/**
 * GET    /api/agendamentos/[id] — detalhe do agendamento
 * PATCH  /api/agendamentos/[id] — atualiza notes/contact
 * DELETE /api/agendamentos/[id] — cancela agendamento
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppointmentById, cancelAppointment } from '@/lib/queries/scheduling';
import { triggerSchedulingAutomation } from '@/lib/utils/scheduling-webhooks';
import { z } from 'zod';

const patchSchema = z.object({
  notes:  z.string().optional().nullable(),
});

const deleteSchema = z.object({
  tenantId: z.string().uuid(),
  reason:   z.string().optional().nullable(),
});

async function getTenantId(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('users').select('tenant_id').eq('id', userId).single();
  return (data as { tenant_id?: string })?.tenant_id ?? null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = await getTenantId(user.id);
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const appointment = await getAppointmentById(id, tenantId);
    if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ data: appointment });
  } catch (error) {
    console.error('Error in GET /api/agendamentos/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = await getTenantId(user.id);
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('sched_appointments')
      .update({ notes: parsed.data.notes })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in PATCH /api/agendamentos/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = await getTenantId(user.id);
    if (!tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const parsed = deleteSchema.safeParse({ tenantId, ...body });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const { id } = await params;
    const appointment = await getAppointmentById(id, tenantId);
    if (!appointment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const result = await cancelAppointment(id, parsed.data.reason ?? null);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    // Dispara automação de cancelamento no n8n (não bloqueia resposta)
    triggerSchedulingAutomation({
      event:       'scheduling.appointment.canceled',
      tenant_id:   tenantId,
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
      automation_config: {},
    }).catch(console.error);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in DELETE /api/agendamentos/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
