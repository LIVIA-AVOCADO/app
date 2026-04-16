/**
 * POST /api/stripe/revert-to-stripe
 *
 * Reverte migração PIX → Stripe:
 * 1. Re-ativa renovação automática no Stripe (cancel_at_period_end = false)
 * 2. Atualiza tenant: subscription_provider = 'stripe'
 *
 * Só funciona se a assinatura Stripe ainda estiver ativa (antes do period_end).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe/client';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      return NextResponse.json({ error: 'Tenant não encontrado', code: 'tenant_not_found' }, { status: 404 });
    }

    const tenantId = userData.tenant_id;
    const adminSupabase = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tenant, error: tenantError } = await (adminSupabase as any)
      .from('tenants')
      .select('stripe_subscription_id, subscription_status, subscription_provider, subscription_cancel_at_period_end')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado', code: 'tenant_not_found' }, { status: 404 });
    }

    if (tenant.subscription_provider !== 'pix_manual') {
      return NextResponse.json({ error: 'Assinatura já está no cartão', code: 'already_stripe' }, { status: 400 });
    }

    if (!tenant.stripe_subscription_id) {
      return NextResponse.json({ error: 'Assinatura Stripe não encontrada', code: 'no_subscription_id' }, { status: 400 });
    }

    if (tenant.subscription_status !== 'active' && tenant.subscription_status !== 'trialing') {
      return NextResponse.json({ error: 'Assinatura Stripe não está mais ativa', code: 'not_active' }, { status: 400 });
    }

    // Re-ativa renovação automática no Stripe
    const stripe = getStripe();
    await stripe.subscriptions.update(tenant.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    // Reverte provider no DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (adminSupabase as any)
      .from('tenants')
      .update({
        subscription_provider: 'stripe',
        subscription_cancel_at_period_end: false,
      })
      .eq('id', tenantId);

    if (updateError) {
      console.error('[revert-to-stripe] Erro ao atualizar tenant:', updateError);
      // Rollback: volta a cancelar no Stripe
      await stripe.subscriptions.update(tenant.stripe_subscription_id, {
        cancel_at_period_end: true,
      }).catch((e) => console.error('[revert-to-stripe] Rollback falhou:', e));

      return NextResponse.json({ error: 'Erro interno', code: 'db_error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[revert-to-stripe] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno', code: 'internal_error' }, { status: 500 });
  }
}
