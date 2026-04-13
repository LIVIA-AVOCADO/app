import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { StripeErrorResponse } from '@/types/stripe';

/**
 * GET /api/stripe/checkout/status?session_id=cs_xxx
 *
 * Returns payment_status and payment_method_type for a checkout session.
 * Used by the success page to show different UI for PIX vs card.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. AUTH
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json<StripeErrorResponse>(
        { error: 'Unauthorized', code: 'unauthorized' },
        { status: 401 }
      );
    }

    // 2. GET TENANT
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      return NextResponse.json<StripeErrorResponse>(
        { error: 'Tenant not found', code: 'tenant_not_found' },
        { status: 404 }
      );
    }

    const tenantId = userData.tenant_id;

    // 3. VALIDATE session_id PARAM
    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json<StripeErrorResponse>(
        { error: 'session_id é obrigatório', code: 'validation_error' },
        { status: 400 }
      );
    }

    // 4. VERIFY TENANT OWNS THIS SESSION
    const adminSupabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessionRow, error: sessionError } = await (adminSupabase as any)
      .from('stripe_checkout_sessions')
      .select('tenant_id')
      .eq('stripe_session_id', sessionId)
      .single();

    if (sessionError || !sessionRow || sessionRow.tenant_id !== tenantId) {
      return NextResponse.json<StripeErrorResponse>(
        { error: 'Sessão não encontrada', code: 'not_found' },
        { status: 404 }
      );
    }

    // 5. FETCH FROM STRIPE
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    const paymentMethodType = session.payment_method_types?.[0] ?? 'card';
    const isPix = paymentMethodType === 'pix' || session.payment_status === 'unpaid';

    return NextResponse.json({
      payment_status: session.payment_status,
      payment_method_type: paymentMethodType,
      is_pix_pending: isPix && session.payment_status !== 'paid',
    });
  } catch (error) {
    console.error('[stripe/checkout/status] Error:', error);
    return NextResponse.json<StripeErrorResponse>(
      { error: 'Erro interno', code: 'internal_error' },
      { status: 500 }
    );
  }
}
