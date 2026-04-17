import { describe, it, expect } from 'vitest';
import { createCheckoutSchema } from '../stripe-validation';

describe('createCheckoutSchema', () => {
  describe('mode: payment', () => {
    it('aceita packageId UUID válido', () => {
      const result = createCheckoutSchema.safeParse({
        mode: 'payment',
        packageId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('rejeita packageId que não é UUID', () => {
      const result = createCheckoutSchema.safeParse({
        mode: 'payment',
        packageId: 'nao-e-uuid',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('ID de pacote inválido');
    });

    it('rejeita sem packageId', () => {
      const result = createCheckoutSchema.safeParse({ mode: 'payment' });
      expect(result.success).toBe(false);
    });
  });

  describe('mode: custom_payment', () => {
    it('aceita valor dentro dos limites', () => {
      const result = createCheckoutSchema.safeParse({
        mode: 'custom_payment',
        customAmountCents: 1000,
      });
      expect(result.success).toBe(true);
    });

    it('rejeita valor abaixo do mínimo (499)', () => {
      const result = createCheckoutSchema.safeParse({
        mode: 'custom_payment',
        customAmountCents: 499,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Valor mínimo: R$ 5,00');
    });

    it('aceita valor exatamente no mínimo (500)', () => {
      const result = createCheckoutSchema.safeParse({
        mode: 'custom_payment',
        customAmountCents: 500,
      });
      expect(result.success).toBe(true);
    });

    it('rejeita valor acima do máximo (500001)', () => {
      const result = createCheckoutSchema.safeParse({
        mode: 'custom_payment',
        customAmountCents: 500001,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Valor máximo: R$ 5.000,00');
    });

    it('aceita valor exatamente no máximo (500000)', () => {
      const result = createCheckoutSchema.safeParse({
        mode: 'custom_payment',
        customAmountCents: 500000,
      });
      expect(result.success).toBe(true);
    });

    it('rejeita valor decimal', () => {
      const result = createCheckoutSchema.safeParse({
        mode: 'custom_payment',
        customAmountCents: 10.5,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Valor deve ser inteiro (centavos)');
    });
  });

  describe('mode: subscription', () => {
    it('aceita priceId válido', () => {
      const result = createCheckoutSchema.safeParse({
        mode: 'subscription',
        priceId: 'price_abc123',
      });
      expect(result.success).toBe(true);
    });

    it('rejeita priceId vazio', () => {
      const result = createCheckoutSchema.safeParse({
        mode: 'subscription',
        priceId: '',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Price ID é obrigatório');
    });

    it('rejeita sem priceId', () => {
      const result = createCheckoutSchema.safeParse({ mode: 'subscription' });
      expect(result.success).toBe(false);
    });
  });

  it('rejeita mode desconhecido', () => {
    const result = createCheckoutSchema.safeParse({ mode: 'unknown' });
    expect(result.success).toBe(false);
  });
});
