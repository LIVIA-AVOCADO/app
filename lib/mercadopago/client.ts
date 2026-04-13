import { MercadoPagoConfig } from 'mercadopago';

let _client: MercadoPagoConfig | null = null;

export function getMercadoPago(): MercadoPagoConfig {
  if (!_client) {
    const raw = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const accessToken = raw?.trim();
    console.log('[MP] access_token raw length:', raw?.length ?? 0);
    console.log('[MP] access_token trimmed length:', accessToken?.length ?? 0);
    console.log('[MP] access_token prefix:', accessToken ? accessToken.slice(0, 15) + '...' : 'UNDEFINED/EMPTY');
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado ou vazio');
    }
    _client = new MercadoPagoConfig({ accessToken });
    console.log('[MP] client criado com sucesso');
  }
  return _client;
}
