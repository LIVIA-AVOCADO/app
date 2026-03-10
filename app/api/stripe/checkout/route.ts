import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSchema } from '@/lib/validations/stripe-validation';
import {
  createCreditCheckoutSession,
  createSubscriptionCheckoutSession,
} from '@/lib/stripe/helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import type { StripeErrorResponse } from '@/types/stripe';

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for credit purchase or subscription.
 * Auth → Tenant → Zod validate → Create session → Return URL
 */
export async function POST(request: NextRequest) {
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

    // 3. VALIDATE INPUT
    const body = await request.json();
    const parsed = createCheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json<StripeErrorResponse>(
        {
          error: 'Dados inválidos',
          code: 'validation_error',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    // 4. BUILD URLs
    const origin = request.nextUrl.origin;
    const successUrl = `${origin}/financeiro/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/financeiro/checkout/cancelado`;

    // 5. CREATE SESSION
    let url: string;
    const input = parsed.data;

    if (input.mode === 'payment') {
      const adminSupabase = createAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pkg, error: pkgError } = await (adminSupabase as any)
        .from('credit_packages')
        .select('price_brl_cents, credits')
        .eq('id', input.packageId)
        .eq('is_active', true)
        .single();

      if (pkgError || !pkg) {
        return NextResponse.json<StripeErrorResponse>(
          { error: 'Pacote não encontrado', code: 'package_not_found' },
          { status: 400 }
        );
      }

      url = await createCreditCheckoutSession(
        tenantId,
        pkg.price_brl_cents,
        pkg.credits,
        successUrl,
        cancelUrl
      );
    } else if (input.mode === 'custom_payment') {
      const customCredits = input.customAmountCents; // 1 crédito = R$ 0,01
      url = await createCreditCheckoutSession(
        tenantId,
        input.customAmountCents,
        customCredits,
        successUrl,
        cancelUrl,
        true
      );
    } else {
      url = await createSubscriptionCheckoutSession(
        tenantId,
        input.priceId,
        successUrl,
        cancelUrl
      );
    }

    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      const statusMap: Record<string, number> = {
        StripeCardError: 402,
        StripeInvalidRequestError: 400,
        StripeRateLimitError: 429,
        StripeConnectionError: 503,
        StripeAuthenticationError: 500,
      };

      const status = statusMap[error.type] || 500;

      console.error('Stripe API error:', error.type, error.message);

      return NextResponse.json<StripeErrorResponse>(
        {
          error: error.message,
          code: `stripe_${error.type}`,
        },
        { status }
      );
    }

    console.error('Checkout API error:', error);
    return NextResponse.json<StripeErrorResponse>(
      { error: 'Erro interno. Tente novamente.', code: 'internal_error' },
      { status: 500 }
    );
  }
}
