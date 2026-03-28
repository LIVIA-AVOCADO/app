/**
 * GET /api/agendamentos/configuracoes — retorna configurações do tenant
 * PUT /api/agendamentos/configuracoes — upsert configurações
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSettings, upsertSettings } from '@/lib/queries/scheduling';
import { z } from 'zod';

const upsertSchema = z.object({
  tenantId:                        z.string().uuid(),
  allowCustomerChooseProfessional: z.boolean().optional(),
  allowAnyAvailableProfessional:   z.boolean().optional(),
  minNoticeMinutes:                z.number().int().min(0).optional(),
  maxBookingWindowDays:            z.number().int().positive().optional(),
  slotGranularityMinutes:          z.number().int().positive().optional(),
  holdDurationMinutes:             z.number().int().positive().optional(),
  availabilityMode:                z.enum(['recurring', 'open_with_blocks', 'hybrid']).optional(),
  automationConfig:                z.record(z.string(), z.unknown()).optional(),
});

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
    const reqTenantId = searchParams.get('tenantId');
    if (reqTenantId && reqTenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await getSettings(tenantId);
    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error('Error in GET /api/agendamentos/configuracoes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = upsertSchema.safeParse(body);
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

    const settings = await upsertSettings({
      tenant_id:                          tenantId,
      allow_customer_choose_professional: parsed.data.allowCustomerChooseProfessional,
      allow_any_available_professional:   parsed.data.allowAnyAvailableProfessional,
      min_notice_minutes:                 parsed.data.minNoticeMinutes,
      max_booking_window_days:            parsed.data.maxBookingWindowDays,
      slot_granularity_minutes:           parsed.data.slotGranularityMinutes,
      hold_duration_minutes:              parsed.data.holdDurationMinutes,
      availability_mode:                  parsed.data.availabilityMode,
      automation_config:                  parsed.data.automationConfig as never,
    });

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error in PUT /api/agendamentos/configuracoes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
