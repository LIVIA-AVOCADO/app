/**
 * Types for Stripe integration
 */

// ===== SUBSCRIPTION =====

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive';

export interface SubscriptionPlan {
  id: string;
  stripe_price_id: string;
  name: string;
  description: string | null;
  price_brl: number; // centavos
  interval: 'month' | 'year';
  features: string[];
  credits_included: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TenantSubscription {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
  subscription_provider: 'stripe' | 'pix_manual';
}

// ===== CHECKOUT =====

export type CheckoutMode = 'payment' | 'subscription';

export type CheckoutSessionStatus = 'pending' | 'completed' | 'expired';

export interface CheckoutSession {
  id: string;
  tenant_id: string;
  stripe_session_id: string;
  mode: CheckoutMode;
  amount_cents: number | null;
  status: CheckoutSessionStatus;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ===== CREDIT PACKAGES =====

export interface CreditPackage {
  id: string;
  amountCents: number;
  credits: number;
  label: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: '500', amountCents: 50000, credits: 50000, label: 'R$ 500' },
  { id: '1000', amountCents: 100000, credits: 100000, label: 'R$ 1.000' },
  { id: '1500', amountCents: 150000, credits: 150000, label: 'R$ 1.500' },
];

// ===== API RESPONSES =====

export interface StripeErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export interface SubscriptionDataResponse {
  subscription: TenantSubscription | null;
  plans: SubscriptionPlan[];
  error: string | null;
}
