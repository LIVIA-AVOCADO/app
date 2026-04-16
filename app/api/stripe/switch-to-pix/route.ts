/**
 * POST /api/stripe/switch-to-pix
 *
 * Migra assinatura ativa do Stripe para PIX manual:
 * 1. Cancela renovação automática no Stripe (cancel_at_period_end = true)
 * 2. Atualiza tenant: subscription_provider = 'pix_manual', subscription_billing_day
 *
 * O acesso é mantido até subscription_current_period_end.
 * O webhook do Mercado Pago estende o período ao confirmar o pagamento PIX.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe/client';

export async function POST() {
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
    const adminSupabase = createAdminClient();

    // 3. BUSCAR DADOS DA ASSINATURA ATUAL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tenant, error: tenantError } = await (adminSupabase as any)
      .from('tenants')
      .select('stripe_subscription_id, subscription_status, subscription_provider, subscription_current_period_end')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado', code: 'tenant_not_found' }, { status: 404 });
    }

    // 4. VALIDAÇÕES
    if (tenant.subscription_provider !== 'stripe') {
      return NextResponse.json(
        { error: 'Assinatura já está em modo PIX', code: 'already_pix' },
        { status: 400 }
      );
    }

    if (tenant.subscription_status !== 'active' && tenant.subscription_status !== 'trialing') {
      return NextResponse.json(
        { error: 'Assinatura não está ativa', code: 'not_active' },
        { status: 400 }
      );
    }

    if (!tenant.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'ID da assinatura Stripe não encontrado', code: 'no_subscription_id' },
        { status: 400 }
      );
    }

    // 5. CANCELA RENOVAÇÃO NO STRIPE (mantém acesso até period_end)
    const stripe = getStripe();
    await stripe.subscriptions.update(tenant.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // 6. EXTRAI BILLING_DAY DO PERIOD_END ATUAL
    const periodEnd = tenant.subscription_current_period_end
      ? new Date(tenant.subscription_current_period_end)
      : new Date();
    const billingDay = periodEnd.getDate();

    // 7. ATUALIZA TENANT NO DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (adminSupabase as any)
      .from('tenants')
      .update({
        subscription_provider: 'pix_manual',
        subscription_billing_day: billingDay,
        subscription_cancel_at_period_end: true,
      })
      .eq('id', tenantId);

    if (updateError) {
      console.error('[switch-to-pix] Erro ao atualizar tenant:', updateError);
      // Rollback: reverter Stripe para não cancelar
      await stripe.subscriptions.update(tenant.stripe_subscription_id, {
        cancel_at_period_end: false,
      }).catch((e) => console.error('[switch-to-pix] Rollback falhou:', e));

      return NextResponse.json({ error: 'Erro interno', code: 'db_error' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      period_end: tenant.subscription_current_period_end,
      billing_day: billingDay,
    });

  } catch (error) {
    console.error('[switch-to-pix] Unexpected error:', error);
    return NextResponse.json({ error: 'Erro interno', code: 'internal_error' }, { status: 500 });
  }
}
