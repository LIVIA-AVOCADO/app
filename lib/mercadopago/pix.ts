import { Payment } from 'mercadopago';
import { getMercadoPago } from './client';

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

/**
 * Cria um pagamento PIX no Mercado Pago.
 * Retorna QR code e dados para exibição ao usuário.
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

  const payment = new Payment(getMercadoPago());

  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

  const response = await payment.create({
    body: {
      transaction_amount: amountCents / 100,
      payment_method_id: 'pix',
      description,
      date_of_expiration: expiresAt.toISOString(),
      payer: {
        email: payerEmail,
      },
      metadata: {
        tenant_id: tenantId,
        type,
        credits,
        amount_cents: amountCents,
      },
    },
  });

  return {
    paymentId: String(response.id),
    qrCode: response.point_of_interaction?.transaction_data?.qr_code ?? '',
    qrCodeBase64: response.point_of_interaction?.transaction_data?.qr_code_base64 ?? '',
    expiresAt: expiresAt.toISOString(),
    status: response.status ?? 'pending',
  };
}

/**
 * Busca o status atual de um pagamento PIX no Mercado Pago.
 */
export async function getPixStatus(mpPaymentId: string): Promise<string> {
  const payment = new Payment(getMercadoPago());
  const response = await payment.get({ id: mpPaymentId });
  return response.status ?? 'pending';
}

/**
 * Calcula a próxima data de vencimento com base no dia fixo do mês.
 * Se o dia não existe no mês alvo, usa o último dia do mês.
 * O novo período sempre começa a partir do currentPeriodEnd (não de hoje),
 * garantindo que o cliente não perde dias já pagos.
 */
export function calcularProximoVencimento(
  billingDay: number,
  currentPeriodEnd: Date
): Date {
  const base = new Date(currentPeriodEnd);
  base.setUTCDate(1); // Vai para o início do próximo mês
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
