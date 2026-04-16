/**
 * Queries for Stripe integration
 *
 * Uses createClient (server-side with RLS) for tenant-scoped queries.
 * Tables not yet in generated Supabase types — using type assertions.
 */

import { createClient } from '@/lib/supabase/server';
import type { SubscriptionPlan, TenantSubscription, CheckoutSession } from '@/types/stripe';

/**
 * Fetches active subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching subscription plans:', error);
    return [];
  }

  return (data || []) as SubscriptionPlan[];
}

/**
 * Fetches tenant subscription data (Stripe fields from tenants table)
 */
export async function getTenantSubscription(
  tenantId: string
): Promise<TenantSubscription | null> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('tenants')
    .select(
      'stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, subscription_cancel_at_period_end, subscription_provider'
    )
    .eq('id', tenantId)
    .single();

  if (error) {
    console.error('Error fetching tenant subscription:', error);
    return null;
  }

  return data as TenantSubscription;
}

/**
 * Fetches checkout sessions for a tenant
 */
export async function getCheckoutSessions(
  tenantId: string,
  limit = 20
): Promise<CheckoutSession[]> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('stripe_checkout_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching checkout sessions:', error);
    return [];
  }

  return (data || []) as CheckoutSession[];
}
