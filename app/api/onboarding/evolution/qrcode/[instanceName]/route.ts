import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EVOLUTION_BASE = process.env.EVOLUTION_API_BASE_URL!;
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY!;

interface RouteContext {
  params: Promise<{ instanceName: string }>;
}

/**
 * GET /api/onboarding/evolution/qrcode/[instanceName]
 * Busca o QR code da instância na Evolution API.
 * Retorna { base64, pairingCode }.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { instanceName } = await params;

  try {
    const res = await fetch(`${EVOLUTION_BASE}/instance/connect/${instanceName}`, {
      headers: { 'apikey': EVOLUTION_KEY },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[evolution/qrcode] error:', res.status, text);
      return NextResponse.json({ error: 'Erro ao obter QR code.' }, { status: 502 });
    }

    const data = await res.json() as { base64?: string; pairingCode?: string; code?: string };
    return NextResponse.json({ base64: data.base64 ?? null, pairingCode: data.pairingCode ?? null });
  } catch (err) {
    console.error('[evolution/qrcode] error:', err);
    return NextResponse.json({ error: 'Erro de conexão.' }, { status: 500 });
  }
}
