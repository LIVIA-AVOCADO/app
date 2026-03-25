/**
 * API Route: Agent Schedule — Is Online
 *
 * Consultado pelo n8n antes de processar cada mensagem recebida.
 * Se o tenant não tiver horários configurados, retorna online: true sem
 * nenhum custo adicional (exceção 24/7).
 *
 * GET /api/agent-schedule/is-online?tenant_id=<uuid>
 *
 * Response:
 *   { online: true }
 *   { online: false, offline_message: "..." | null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tenantId = searchParams.get('tenant_id');

  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenant_id é obrigatório' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    // Chama a RPC que encapsula toda a lógica de horários.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('is_agent_online', {
      p_tenant_id: tenantId,
    });

    if (error) {
      console.error('[agent-schedule/is-online] RPC error:', error);
      // Em caso de erro, assume online para não bloquear atendimentos.
      return NextResponse.json({ online: true });
    }

    const result = data as {
      online: boolean;
      reason: string;
      offline_message?: string | null;
    };

    if (result.online) {
      return NextResponse.json({ online: true });
    }

    return NextResponse.json({
      online: false,
      offline_message: result.offline_message ?? null,
    });
  } catch (err) {
    console.error('[agent-schedule/is-online] Unexpected error:', err);
    // Falha segura: assume online para não bloquear atendimentos.
    return NextResponse.json({ online: true });
  }
}
