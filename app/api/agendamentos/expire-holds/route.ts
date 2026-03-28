/**
 * POST /api/agendamentos/expire-holds
 *
 * Chamado pelo n8n via cron a cada 5 minutos.
 * Expira holds vencidos e libera alocações de recursos.
 *
 * Autenticação: header X-Cron-Secret (não requer sessão de usuário).
 */

import { NextRequest, NextResponse } from 'next/server';
import { expireHolds } from '@/lib/queries/scheduling';

const SCHEDULING_CRON_SECRET = process.env.SCHEDULING_CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Valida secret do cron
    const secret = request.headers.get('x-cron-secret');
    if (!SCHEDULING_CRON_SECRET || secret !== SCHEDULING_CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenant_id ?? null;

    const result = await expireHolds(tenantId);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in POST /api/agendamentos/expire-holds:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
