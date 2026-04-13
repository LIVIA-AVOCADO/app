export type PixPaymentType = 'credit_purchase' | 'subscription';

export interface CreatePixPaymentParams {
  tenantId: string;
  amountCents: number;
  credits: number;
  payerEmail: string;
  description: string;
  type: PixPaymentType;
  expirationMinutes?: number;
}

export interface PixPaymentResult {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  status: string;
}

function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
  return token;
}

/**
 * Cria um pagamento PIX no Mercado Pago via REST API (sem SDK).
 */
export async function createPixPayment(
  params: CreatePixPaymentParams
): Promise<PixPaymentResult> {
  const {
    tenantId,
    amountCents,
    credits,
    payerEmail,
    description,
    type,
    expirationMinutes = 30,
  } = params;

  const accessToken = getAccessToken();
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
  const idempotencyKey = `${tenantId}-${Date.now()}`;

  console.log('[MP] criando pagamento PIX, token prefix:', accessToken.slice(0, 15) + '...');

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: amountCents / 100,
      payment_method_id: 'pix',
      description,
      date_of_expiration: expiresAt.toISOString(),
      payer: { email: payerEmail },
      metadata: {
        tenant_id: tenantId,
        type,
        credits,
        amount_cents: amountCents,
      },
    }),
  });

  const data = await response.json();
  console.log('[MP] resposta status:', response.status, 'payment id:', data.id);

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return {
    paymentId: String(data.id),
    qrCode: data.point_of_interaction?.transaction_data?.qr_code ?? '',
    qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64 ?? '',
    expiresAt: expiresAt.toISOString(),
    status: data.status ?? 'pending',
  };
}

/**
 * Busca o status atual de um pagamento PIX no Mercado Pago via REST.
 */
export async function getPixStatus(mpPaymentId: string): Promise<string> {
  const accessToken = getAccessToken();

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) return 'pending';

  const data = await response.json();
  return data.status ?? 'pending';
}

/**
 * Calcula a próxima data de vencimento com base no dia fixo do mês.
 * Se o dia não existe no mês alvo, usa o último dia do mês.
 * O novo período sempre começa a partir do currentPeriodEnd,
 * garantindo que o cliente não perde dias já pagos.
 */
export function calcularProximoVencimento(
  billingDay: number,
  currentPeriodEnd: Date
): Date {
  const base = new Date(currentPeriodEnd);
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + 1);

  const diasNoMes = new Date(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    0
  ).getUTCDate();

  base.setUTCDate(Math.min(billingDay, diasNoMes));
  base.setUTCHours(23, 59, 59, 0);

  return base;
}
