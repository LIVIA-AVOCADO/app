import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logStripeEvent, logStripeError } from './logger';

/**
 * Resolves tenant_id from Stripe customer metadata or DB lookup.
 */
async function resolveTenantId(
  supabaseAdmin: SupabaseClient,
  customerId: string | null,
  metadata?: Stripe.Metadata | null
): Promise<string | null> {
  console.log('[STRIPE] resolveTenantId:', { customerId, metadata });

  // Try metadata first
  if (metadata?.tenant_id) {
    console.log('[STRIPE] Found tenant_id in metadata:', metadata.tenant_id);
    return metadata.tenant_id;
  }

  // Lookup by stripe_customer_id
  if (customerId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('tenants')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    console.log('[STRIPE] Tenant lookup by customer_id:', { data, error });
    return data?.id ?? null;
  }

  return null;
}

/**
 * Checks if a source_ref already exists in ledger_entries (idempotency).
 */
async function isAlreadyProcessed(
  supabaseAdmin: SupabaseClient,
  sourceRef: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from('ledger_entries')
    .select('id')
    .eq('source_ref', sourceRef)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

// ============================================================================
// checkout.session.completed
// ============================================================================

export async function handleCheckoutCompleted(
  event: Stripe.Event,
  supabaseAdmin: SupabaseClient
) {
  const session = event.data.object as Stripe.Checkout.Session;
  const eventId = event.id;

  const tenantId = await resolveTenantId(
    supabaseAdmin,
    session.customer as string | null,
    session.metadata
  );

  if (!tenantId) {
    logStripeError('handleCheckoutCompleted', 'Tenant not found for customer', {
      customerId: session.customer,
      eventId,
    });
    return; // Return 200 — don't retry, investigate manually
  }

  if (session.mode === 'payment') {
    // PIX payments are async: checkout.session.completed fires when the QR code is
    // generated (payment_status = 'unpaid'). Only credit the wallet immediately for
    // card payments (payment_status = 'paid'). PIX is handled by
    // checkout.session.async_payment_succeeded.
    if (session.payment_status !== 'paid') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from('stripe_checkout_sessions')
        .update({ status: 'pix_pending', updated_at: new Date().toISOString() })
        .eq('stripe_session_id', session.id);
      logStripeEvent('checkout.session.completed', eventId, tenantId, 'pix_pending');
      return;
    }

    await creditWalletFromCheckoutSession(
      session,
      eventId,
      tenantId,
      supabaseAdmin,
      'checkout.session.completed'
    );
  } else if (session.mode === 'subscription') {
    // Subscription activation is handled by customer.subscription.updated
    logStripeEvent('checkout.session.completed', eventId, tenantId, 'success');
  }
}

// ============================================================================
// Shared helper: credit wallet from a checkout session
// ============================================================================

async function creditWalletFromCheckoutSession(
  session: Stripe.Checkout.Session,
  eventId: string,
  tenantId: string,
  supabaseAdmin: SupabaseClient,
  eventType: string
) {
  const sourceRef = `stripe_checkout_${session.id}`;
  const credits = Number(session.metadata?.package_credits || 0);

  if (credits <= 0) {
    logStripeError(eventType, 'Invalid credits amount', {
      sessionId: session.id,
      tenantId,
    });
    return;
  }

  // Idempotency check
  if (await isAlreadyProcessed(supabaseAdmin, sourceRef)) {
    logStripeEvent(eventType, eventId, tenantId, 'skipped');
    return;
  }

  // Update checkout session status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('stripe_checkout_sessions')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('stripe_session_id', session.id);

  // Credit wallet via RPC
  console.log('[STRIPE] Calling credit_wallet RPC:', { tenantId, credits, sourceRef });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcError, data: rpcData } = await (supabaseAdmin as any).rpc('credit_wallet', {
    p_tenant_id: tenantId,
    p_amount_credits: credits,
    p_source_type: 'purchase',
    p_source_ref: sourceRef,
    p_description: `Compra de ${credits.toLocaleString('pt-BR')} créditos via Stripe`,
    p_meta: {
      stripe_session_id: session.id,
      stripe_event_id: eventId,
      amount_cents: session.metadata?.package_amount_cents,
    },
  });
  console.log('[STRIPE] credit_wallet result:', { rpcError, rpcData });

  if (rpcError) {
    logStripeError(`${eventType}.credit_wallet`, rpcError, {
      tenantId,
      credits,
      sourceRef,
    });
    throw rpcError; // Return 500 to retry
  }

  logStripeEvent(eventType, eventId, tenantId, 'success');
}

// ============================================================================
// checkout.session.async_payment_succeeded (PIX paid)
// ============================================================================

export async function handleAsyncPaymentSucceeded(
  event: Stripe.Event,
  supabaseAdmin: SupabaseClient
) {
  const session = event.data.object as Stripe.Checkout.Session;
  const eventId = event.id;

  const tenantId = await resolveTenantId(
    supabaseAdmin,
    session.customer as string | null,
    session.metadata
  );

  if (!tenantId) {
    logStripeError('handleAsyncPaymentSucceeded', 'Tenant not found for customer', {
      customerId: session.customer,
      eventId,
    });
    return;
  }

  if (session.mode !== 'payment') return;

  await creditWalletFromCheckoutSession(
    session,
    eventId,
    tenantId,
    supabaseAdmin,
    'checkout.session.async_payment_succeeded'
  );
}

// ============================================================================
// checkout.session.async_payment_failed (PIX expired without payment)
// ============================================================================

export async function handleAsyncPaymentFailed(
  event: Stripe.Event,
  supabaseAdmin: SupabaseClient
) {
  const session = event.data.object as Stripe.Checkout.Session;
  const eventId = event.id;

  const tenantId = await resolveTenantId(
    supabaseAdmin,
    session.customer as string | null,
    session.metadata
  );

  if (!tenantId) {
    logStripeError('handleAsyncPaymentFailed', 'Tenant not found', {
      customerId: session.customer,
      eventId,
    });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('stripe_checkout_sessions')
    .update({ status: 'pix_failed', updated_at: new Date().toISOString() })
    .eq('stripe_session_id', session.id);

  logStripeEvent('checkout.session.async_payment_failed', eventId, tenantId, 'success');
}

// ============================================================================
// invoice.paid
// ============================================================================

export async function handleInvoicePaid(
  event: Stripe.Event,
  supabaseAdmin: SupabaseClient
) {
  const invoice = event.data.object as Stripe.Invoice;
  const eventId = event.id;
  const customerId = invoice.customer as string | null;

  const tenantId = await resolveTenantId(supabaseAdmin, customerId);

  if (!tenantId) {
    logStripeError('handleInvoicePaid', 'Tenant not found', {
      customerId,
      eventId,
    });
    return;
  }

  // Update subscription period if subscription invoice
  // Stripe SDK v20.3.1: subscription is accessed via parent.subscription_details
  const subscriptionDetails = invoice.parent?.subscription_details;
  if (subscriptionDetails?.subscription) {
    const subscriptionId = typeof subscriptionDetails.subscription === 'string'
      ? subscriptionDetails.subscription
      : subscriptionDetails.subscription.id;

    // Extract period_end from invoice lines or invoice fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoiceAny = invoice as any;
    const linePeriodEnd = invoice.lines?.data?.[0]?.period?.end;
    const rawPeriodEnd = linePeriodEnd || invoiceAny.period_end;
    const periodEnd = rawPeriodEnd
      ? new Date(rawPeriodEnd * 1000).toISOString()
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      subscription_status: 'active',
      stripe_subscription_id: subscriptionId,
    };
    if (periodEnd) {
      updateData.subscription_current_period_end = periodEnd;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('tenants')
      .update(updateData)
      .eq('id', tenantId);
  }

  logStripeEvent('invoice.paid', eventId, tenantId, 'success');
}

// ============================================================================
// invoice.payment_failed
// ============================================================================

export async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  supabaseAdmin: SupabaseClient
) {
  const invoice = event.data.object as Stripe.Invoice;
  const eventId = event.id;
  const customerId = invoice.customer as string | null;

  const tenantId = await resolveTenantId(supabaseAdmin, customerId);

  if (!tenantId) {
    logStripeError('handleInvoicePaymentFailed', 'Tenant not found', {
      customerId,
      eventId,
    });
    return;
  }

  // Mark subscription as past_due
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('tenants')
    .update({ subscription_status: 'past_due' })
    .eq('id', tenantId);

  // Create billing notification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('billing_notifications')
    .insert({
      tenant_id: tenantId,
      severity: 'critical',
      type: 'payment_failed',
      title: 'Falha no pagamento da assinatura',
      message: `O pagamento da fatura ${invoice.number || invoice.id} falhou. Regularize para manter o acesso.`,
      channels: ['email', 'dashboard'],
      status: 'pending',
      meta: {
        stripe_invoice_id: invoice.id,
        stripe_event_id: eventId,
        amount_due: invoice.amount_due,
      },
    });

  logStripeEvent('invoice.payment_failed', eventId, tenantId, 'success');
}

// ============================================================================
// customer.subscription.updated
// ============================================================================

export async function handleSubscriptionUpdated(
  event: Stripe.Event,
  supabaseAdmin: SupabaseClient
) {
  const subscription = event.data.object as Stripe.Subscription;
  const eventId = event.id;
  const customerId = subscription.customer as string;

  const tenantId = await resolveTenantId(supabaseAdmin, customerId);

  if (!tenantId) {
    logStripeError('handleSubscriptionUpdated', 'Tenant not found', {
      customerId,
      eventId,
    });
    return;
  }

  // Stripe SDK v20.3.1: current_period_end moved to subscription items
  // Try items first, then fallback to top-level (via any) for older API versions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subAny = subscription as any;
  const itemPeriodEnd = subscription.items?.data?.[0]?.current_period_end;
  const rawPeriodEnd = itemPeriodEnd || subAny.current_period_end;
  const periodEnd = rawPeriodEnd
    ? new Date(rawPeriodEnd * 1000).toISOString()
    : null;

  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('tenants')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: statusMap[subscription.status] || 'inactive',
      subscription_current_period_end: periodEnd,
      subscription_cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq('id', tenantId);

  logStripeEvent('customer.subscription.updated', eventId, tenantId, 'success');
}

// ============================================================================
// payment_intent.succeeded (auto-recharge)
// ============================================================================

export async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  supabaseAdmin: SupabaseClient
) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const eventId = event.id;

  // Only process auto-recharge payments
  if (paymentIntent.metadata?.type !== 'auto_recharge') {
    return;
  }

  const tenantId = paymentIntent.metadata.tenant_id;
  const credits = Number(paymentIntent.metadata.credits || 0);

  if (!tenantId || credits <= 0) {
    logStripeError('handlePaymentIntentSucceeded', 'Invalid auto-recharge metadata', {
      paymentIntentId: paymentIntent.id,
      eventId,
    });
    return;
  }

  const sourceRef = `stripe_pi_${paymentIntent.id}`;

  // Idempotency check
  if (await isAlreadyProcessed(supabaseAdmin, sourceRef)) {
    logStripeEvent('payment_intent.succeeded', eventId, tenantId, 'skipped');
    return;
  }

  // Credit wallet via RPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcError } = await (supabaseAdmin as any).rpc('credit_wallet', {
    p_tenant_id: tenantId,
    p_amount_credits: credits,
    p_source_type: 'purchase',
    p_source_ref: sourceRef,
    p_description: `Recarga automática de ${credits.toLocaleString('pt-BR')} créditos`,
    p_meta: {
      stripe_payment_intent_id: paymentIntent.id,
      stripe_event_id: eventId,
      is_auto_recharge: true,
      auto_recharge_config_id: paymentIntent.metadata.auto_recharge_config_id,
    },
  });

  if (rpcError) {
    logStripeError('handlePaymentIntentSucceeded.credit_wallet', rpcError, {
      tenantId,
      credits,
      sourceRef,
    });
    throw rpcError;
  }

  logStripeEvent('payment_intent.succeeded', eventId, tenantId, 'success');
}

// ============================================================================
// customer.subscription.deleted
// ============================================================================

export async function handleSubscriptionDeleted(
  event: Stripe.Event,
  supabaseAdmin: SupabaseClient
) {
  const subscription = event.data.object as Stripe.Subscription;
  const eventId = event.id;
  const customerId = subscription.customer as string;

  const tenantId = await resolveTenantId(supabaseAdmin, customerId);

  if (!tenantId) {
    logStripeError('handleSubscriptionDeleted', 'Tenant not found', {
      customerId,
      eventId,
    });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('tenants')
    .update({
      subscription_status: 'canceled',
      subscription_cancel_at_period_end: false,
    })
    .eq('id', tenantId);

  // Create notification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('billing_notifications')
    .insert({
      tenant_id: tenantId,
      severity: 'warning',
      type: 'payment_failed',
      title: 'Assinatura cancelada',
      message: 'Sua assinatura de manutenção foi cancelada. Assine novamente para manter o acesso.',
      channels: ['email', 'dashboard'],
      status: 'pending',
      meta: {
        stripe_subscription_id: subscription.id,
        stripe_event_id: eventId,
      },
    });

  logStripeEvent('customer.subscription.deleted', eventId, tenantId, 'success');
}
