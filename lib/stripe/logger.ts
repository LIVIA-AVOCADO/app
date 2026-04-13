/**
 * Structured logging for Stripe events
 */

export function logStripeEvent(
  eventType: string,
  eventId: string,
  tenantId: string | null,
  status: 'processing' | 'success' | 'skipped' | 'error' | 'pix_pending'
) {
  console.log(
    `[STRIPE] [${eventType}] [${tenantId ?? 'unknown'}] [${status}] event=${eventId}`
  );
}

export function logStripeError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(
    `[STRIPE] [ERROR] [${context}] ${message}`,
    { ...metadata, stack }
  );
}
