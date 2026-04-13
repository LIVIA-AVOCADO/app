import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPixStatus } from '@/lib/mercadopago/pix';

/**
 * GET /api/mercadopago/pix/status?payment_id=xxx
 *
 * Verifica o status atual de um pagamento PIX.
 * Usado pelo polling da página de checkout PIX.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. AUTH
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    // 2. TENANT
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      return NextResponse.json({ error: 'Tenant não encontrado', code: 'tenant_not_found' }, { status: 404 });
    }

    const tenantId = userData.tenant_id;

    // 3. PARAM
    const paymentId = request.nextUrl.searchParams.get('payment_id');
    if (!paymentId) {
      return NextResponse.json({ error: 'payment_id é obrigatório', code: 'validation_error' }, { status: 400 });
    }

    // 4. VERIFICA QUE O PAGAMENTO PERTENCE AO TENANT
    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error: rowError } = await (adminSupabase as any)
      .from('mp_pix_payments')
      .select('tenant_id, status, credits, amount_cents, expires_at')
      .eq('mp_payment_id', paymentId)
      .single();

    if (rowError || !row || row.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Pagamento não encontrado', code: 'not_found' }, { status: 404 });
    }

    // 5. SE JÁ FOI PROCESSADO, RETORNA DO DB (evita chamada desnecessária ao MP)
    if (row.status === 'approved') {
      return NextResponse.json({ status: 'approved', credits: row.credits });
    }
    if (row.status === 'cancelled' || row.status === 'expired' || row.status === 'rejected') {
      return NextResponse.json({ status: row.status });
    }

    // 6. CONSULTA STATUS ATUALIZADO NO MERCADO PAGO
    const mpStatus = await getPixStatus(paymentId);

    // 7. SINCRONIZA STATUS NO DB SE MUDOU
    if (mpStatus !== row.status) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminSupabase as any)
        .from('mp_pix_payments')
        .update({ status: mpStatus })
        .eq('mp_payment_id', paymentId);
    }

    return NextResponse.json({
      status: mpStatus,
      credits: mpStatus === 'approved' ? row.credits : undefined,
    });
  } catch (error) {
    console.error('[mp/pix/status] Error:', error);
    return NextResponse.json({ error: 'Erro interno', code: 'internal_error' }, { status: 500 });
  }
}
