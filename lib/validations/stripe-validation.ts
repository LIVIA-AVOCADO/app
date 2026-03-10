import { z } from 'zod';

export const createCheckoutSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('payment'),
    packageId: z.string().uuid('ID de pacote inválido'),
  }),
  z.object({
    mode: z.literal('custom_payment'),
    customAmountCents: z
      .number()
      .int('Valor deve ser inteiro (centavos)')
      .min(500, 'Valor mínimo: R$ 5,00')
      .max(500000, 'Valor máximo: R$ 5.000,00'),
  }),
  z.object({
    mode: z.literal('subscription'),
    priceId: z.string().min(1, 'Price ID é obrigatório'),
  }),
]);

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
