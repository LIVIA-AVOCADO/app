/**
 * Retorna o Access Token do Mercado Pago.
 * Mantido como helper para uso no webhook handler.
 */
export function getMPAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
  return token;
}
