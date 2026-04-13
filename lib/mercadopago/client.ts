import { MercadoPagoConfig } from 'mercadopago';

let _client: MercadoPagoConfig | null = null;

export function getMercadoPago(): MercadoPagoConfig {
  if (!_client) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }
    _client = new MercadoPagoConfig({ accessToken });
  }
  return _client;
}
