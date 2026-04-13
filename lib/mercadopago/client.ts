import { MercadoPagoConfig } from 'mercadopago';

let _client: MercadoPagoConfig | null = null;

export function getMercadoPago(): MercadoPagoConfig {
  if (!_client) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    console.log('[MP] access_token prefix:', accessToken ? accessToken.slice(0, 12) + '...' : 'UNDEFINED');
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }
    _client = new MercadoPagoConfig({ accessToken });
  }
  return _client;
}
