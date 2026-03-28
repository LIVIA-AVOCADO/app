/**
 * GET  /api/agendamentos/recursos
 * POST /api/agendamentos/recursos
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getResources, createResource } from '@/lib/queries/scheduling';
import type { ResourceType } from '@/types/scheduling';
import { z } from 'zod';

const createSchema = z.object({
  tenantId:     z.string().uuid(),
  name:         z.string().min(1, 'Nome é obrigatório').max(100),
  resourceType: z.enum(['staff', 'room', 'equipment', 'vehicle', 'team']),
  unitId:       z.string().uuid().optional().nullable(),
  userId:       z.string().uuid().optional().nullable(),
  metadata:     z.record(z.string(), z.unknown()).optional(),
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
    const data = await getResources(tenantId, {
      resourceType: (searchParams.get('resourceType') as ResourceType) ?? undefined,
      unitId:       searchParams.get('unitId') ?? undefined,
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/agendamentos/recursos:', error);
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

    const resource = await createResource({
      tenant_id:     tenantId,
      name:          parsed.data.name,
      resource_type: parsed.data.resourceType,
      unit_id:       parsed.data.unitId,
      user_id:       parsed.data.userId,
      metadata:      parsed.data.metadata ?? {},
    });

    return NextResponse.json({ success: true, data: resource }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/agendamentos/recursos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
