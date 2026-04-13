import { getStripe } from './client';
import { createAdminClient } from '@/lib/supabase/admin';
import { logStripeError } from './logger';

/**
 * Gets existing Stripe customer or creates a new one for the tenant.
 * Stores stripe_customer_id on tenants table.
 */
export async function getOrCreateStripeCustomer(tenantId: string): Promise<string> {
  const supabase = createAdminClient();

  // Check if tenant already has a Stripe customer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant, error: tenantError } = await (supabase as any)
    .from('tenants')
    .select('stripe_customer_id, name, responsible_finance_email, cnpj')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  // Validate existing customer still exists in current Stripe environment (test vs live)
  if (tenant.stripe_customer_id) {
    try {
      const existing = await getStripe().customers.retrieve(tenant.stripe_customer_id);
      if (!existing.deleted) {
        return tenant.stripe_customer_id;
      }
    } catch {
      // Customer not found in current environment (e.g. test ID used in live mode) — create new one
    }
  }

  // Create new Stripe customer
  const customer = await getStripe().customers.create({
    email: tenant.responsible_finance_email || undefined,
    name: tenant.name || undefined,
    metadata: {
      tenant_id: tenantId,
      cnpj: tenant.cnpj || '',
    },
  });

  // Save stripe_customer_id on tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('tenants')
    .update({ stripe_customer_id: customer.id })
    .eq('id', tenantId);

  if (updateError) {
    logStripeError('getOrCreateStripeCustomer', updateError, { tenantId });
    throw new Error('Failed to save Stripe customer ID');
  }

  return customer.id;
}

/**
 * Creates a Stripe Checkout session for credit package purchase (one-time payment).
 */
export async function createCreditCheckoutSession(
  tenantId: string,
  packageAmountCents: number,
  packageCredits: number,
  successUrl: string,
  cancelUrl: string,
  isCustom = false
): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(tenantId);

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'brl',
          unit_amount: packageAmountCents,
          product_data: {
            name: `Pacote de ${(packageCredits).toLocaleString('pt-BR')} créditos`,
            description: `Recarga de créditos LIVIA - R$ ${(packageAmountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      tenant_id: tenantId,
      type: 'credit_purchase',
      package_amount_cents: String(packageAmountCents),
      package_credits: String(packageCredits),
      is_custom: String(isCustom),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  // Track checkout session in DB
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('stripe_checkout_sessions').insert({
    tenant_id: tenantId,
    stripe_session_id: session.id,
    mode: 'payment',
    amount_cents: packageAmountCents,
    status: 'pending',
    meta: { credits: packageCredits },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  return session.url;
}

/**
 * Creates a Stripe Checkout session for subscription.
 */
export async function createSubscriptionCheckoutSession(
  tenantId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(tenantId);

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      tenant_id: tenantId,
      type: 'subscription',
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  // Track checkout session in DB
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('stripe_checkout_sessions').insert({
    tenant_id: tenantId,
    stripe_session_id: session.id,
    mode: 'subscription',
    status: 'pending',
    meta: { price_id: priceId },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  return session.url;
}

/**
 * Creates a Stripe Customer Portal session.
 */
export async function createPortalSession(
  tenantId: string,
  returnUrl: string
): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(tenantId);

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}
