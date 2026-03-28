/**
 * GET  /api/agendamentos/servicos
 * POST /api/agendamentos/servicos
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServices, createService } from '@/lib/queries/scheduling';
import { z } from 'zod';

const createSchema = z.object({
  tenantId:            z.string().uuid(),
  name:                z.string().min(1, 'Nome é obrigatório').max(100),
  serviceType:         z.string().optional(),
  description:         z.string().optional().nullable(),
  durationMinutes:     z.number().int().positive('Duração deve ser positiva'),
  bufferBeforeMinutes: z.number().int().min(0).optional(),
  bufferAfterMinutes:  z.number().int().min(0).optional(),
  priceCents:          z.number().int().min(0).optional().nullable(),
  metadata:            z.record(z.string(), z.unknown()).optional(),
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
    const data = await getServices(tenantId, {
      search:     searchParams.get('search') ?? undefined,
      onlyActive: searchParams.get('onlyActive') !== 'false',
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/agendamentos/servicos:', error);
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

    const service = await createService({
      tenant_id:            tenantId,
      name:                 parsed.data.name,
      service_type:         parsed.data.serviceType ?? 'generic',
      description:          parsed.data.description,
      duration_minutes:     parsed.data.durationMinutes,
      buffer_before_minutes: parsed.data.bufferBeforeMinutes ?? 0,
      buffer_after_minutes:  parsed.data.bufferAfterMinutes  ?? 0,
      price_cents:          parsed.data.priceCents,
      metadata:             parsed.data.metadata ?? {},
    });

    return NextResponse.json({ success: true, data: service }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/agendamentos/servicos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
