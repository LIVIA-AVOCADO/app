import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/stripe/client', () => ({ getStripe: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn().mockReturnValue({}) }));
vi.mock('@/lib/stripe/logger', () => ({
  logStripeEvent: vi.fn(),
  logStripeError: vi.fn(),
}));
vi.mock('@/lib/stripe/webhook-handlers', () => ({
  handleCheckoutCompleted: vi.fn().mockResolvedValue(undefined),
  handleAsyncPaymentSucceeded: vi.fn().mockResolvedValue(undefined),
  handleAsyncPaymentFailed: vi.fn().mockResolvedValue(undefined),
  handleInvoicePaid: vi.fn().mockResolvedValue(undefined),
  handleInvoicePaymentFailed: vi.fn().mockResolvedValue(undefined),
  handleSubscriptionUpdated: vi.fn().mockResolvedValue(undefined),
  handleSubscriptionDeleted: vi.fn().mockResolvedValue(undefined),
  handlePaymentIntentSucceeded: vi.fn().mockResolvedValue(undefined),
}));

import { getStripe } from '@/lib/stripe/client';
import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
} from '@/lib/stripe/webhook-handlers';
import { POST } from '../route';

const mockGetStripe = vi.mocked(getStripe);
const mockHandleCheckout = vi.mocked(handleCheckoutCompleted);
const mockHandleSubscription = vi.mocked(handleSubscriptionUpdated);

function buildRequest(body = 'raw_body', signature?: string) {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'stripe-signature': signature } : {}),
    },
  });
}

function mockStripeWithEvent(eventType: string, eventData: unknown = {}) {
  const event = { type: eventType, id: 'evt_test', ...eventData };
  const stripeMock = {
    webhooks: {
      constructEvent: vi.fn().mockReturnValue(event),
    },
  };
  mockGetStripe.mockReturnValue(stripeMock as any);
  return { event, stripeMock };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe('POST /api/stripe/webhook', () => {
  it('retorna 400 quando stripe-signature header está ausente', async () => {
    const res = await POST(buildRequest('body', undefined));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('missing_signature');
  });

  it('retorna 500 quando STRIPE_WEBHOOK_SECRET não está configurado', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(buildRequest('body', 'sig_test'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('not_configured');
  });

  it('retorna 400 quando assinatura é inválida (constructEvent lança)', async () => {
    const stripeMock = {
      webhooks: {
        constructEvent: vi.fn().mockImplementation(() => {
          throw new Error('No signatures found matching the expected signature');
        }),
      },
    };
    mockGetStripe.mockReturnValue(stripeMock as any);

    const res = await POST(buildRequest('body', 'sig_invalida'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('invalid_signature');
  });

  it('retorna 200 e chama handler para checkout.session.completed', async () => {
    mockStripeWithEvent('checkout.session.completed');
    const res = await POST(buildRequest('body', 'sig_valid'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(mockHandleCheckout).toHaveBeenCalledOnce();
  });

  it('retorna 200 e chama handler para customer.subscription.updated', async () => {
    mockStripeWithEvent('customer.subscription.updated');
    const res = await POST(buildRequest('body', 'sig_valid'));
    expect(res.status).toBe(200);
    expect(mockHandleSubscription).toHaveBeenCalledOnce();
  });

  it('retorna 200 para evento desconhecido (passthrough)', async () => {
    mockStripeWithEvent('payment_method.attached');
    const res = await POST(buildRequest('body', 'sig_valid'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it('retorna 500 quando handler lança exceção', async () => {
    mockStripeWithEvent('checkout.session.completed');
    mockHandleCheckout.mockRejectedValue(new Error('Handler failed'));

    const res = await POST(buildRequest('body', 'sig_valid'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('handler_error');
  });
});
