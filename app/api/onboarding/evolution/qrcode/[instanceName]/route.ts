import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { connectInstance } from '@/lib/evolution/client';

interface RouteContext {
  params: Promise<{ instanceName: string }>;
}

/**
 * GET /api/onboarding/evolution/qrcode/[instanceName]
 * Busca o QR code da instância usando o client centralizado.
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
    const qr = await connectInstance(instanceName);
    return NextResponse.json({ base64: qr.base64, pairingCode: qr.pairingCode ?? null });
  } catch (err) {
    console.error('[evolution/qrcode] error:', err);
    return NextResponse.json({ base64: null, pairingCode: null });
  }
}
