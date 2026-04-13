import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { logStripeEvent, logStripeError } from '@/lib/stripe/logger';
import {
  handleCheckoutCompleted,
  handleAsyncPaymentSucceeded,
  handleAsyncPaymentFailed,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handlePaymentIntentSucceeded,
} from '@/lib/stripe/webhook-handlers';

/**
 * Stripe Webhook Handler
 *
 * No auth — uses Stripe signature verification instead.
 * Returns 200 quickly for unknown events.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header', code: 'missing_signature' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logStripeError('webhook', 'STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook not configured', code: 'not_configured' },
      { status: 500 }
    );
  }

  let event;
  try {
    const rawBody = await request.text();
    console.log('[STRIPE WEBHOOK] Raw body received, length:', rawBody.length);
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    console.log('[STRIPE WEBHOOK] Event verified:', event.type, event.id);
  } catch (err) {
    logStripeError('webhook.signature', err);
    return NextResponse.json(
      { error: 'Invalid signature', code: 'invalid_signature' },
      { status: 400 }
    );
  }

  const supabaseAdmin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('[STRIPE WEBHOOK] Handling checkout.session.completed...');
        await handleCheckoutCompleted(event, supabaseAdmin);
        console.log('[STRIPE WEBHOOK] checkout.session.completed handled OK');
        break;

      case 'checkout.session.async_payment_succeeded':
        console.log('[STRIPE WEBHOOK] Handling checkout.session.async_payment_succeeded...');
        await handleAsyncPaymentSucceeded(event, supabaseAdmin);
        console.log('[STRIPE WEBHOOK] checkout.session.async_payment_succeeded handled OK');
        break;

      case 'checkout.session.async_payment_failed':
        console.log('[STRIPE WEBHOOK] Handling checkout.session.async_payment_failed...');
        await handleAsyncPaymentFailed(event, supabaseAdmin);
        console.log('[STRIPE WEBHOOK] checkout.session.async_payment_failed handled OK');
        break;

      case 'invoice.paid':
        console.log('[STRIPE WEBHOOK] Handling invoice.paid...');
        await handleInvoicePaid(event, supabaseAdmin);
        console.log('[STRIPE WEBHOOK] invoice.paid handled OK');
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event, supabaseAdmin);
        break;

      case 'customer.subscription.updated':
        console.log('[STRIPE WEBHOOK] Handling customer.subscription.updated...');
        await handleSubscriptionUpdated(event, supabaseAdmin);
        console.log('[STRIPE WEBHOOK] customer.subscription.updated handled OK');
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, supabaseAdmin);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event, supabaseAdmin);
        break;

      default:
        console.log('[STRIPE WEBHOOK] Unhandled event type:', event.type);
        logStripeEvent(event.type, event.id, null, 'skipped');
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Handler error:', error);
    logStripeError('webhook.handler', error, {
      eventType: event.type,
      eventId: event.id,
    });
    return NextResponse.json(
      { error: 'Webhook handler failed', code: 'handler_error' },
      { status: 500 }
    );
  }
}
