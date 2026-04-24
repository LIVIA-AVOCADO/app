// Zod validation schemas for Reactivation Settings
// Feature: Reativacao de Conversas

import { z } from 'zod';

// Schema para settings globais
export const reactivationSettingsSchema = z.object({
  exhausted_action: z.enum(['end_conversation', 'transfer_to_human', 'do_nothing'], {
    message: 'Selecione uma acao valida',
  }),
  exhausted_message: z.string().max(2000, 'Maximo 2000 caracteres').default(''),
  max_reactivation_window_minutes: z
    .number()
    .int('Deve ser um numero inteiro')
    .min(1, 'Minimo 1 minuto')
    .max(43200, 'Maximo 30 dias (43200 minutos)')
    .nullable()
    .default(null),
  max_window_action: z.enum(['end_conversation', 'transfer_to_human', 'do_nothing'], {
    message: 'Selecione uma acao valida',
  }),
  max_window_message: z.string().max(2000, 'Maximo 2000 caracteres').default(''),
  reactivate_when_ia_active_false: z.boolean().default(false),
  reactivate_only_after_first_human_message: z.boolean().default(false),
});

// Schema para um step individual
export const reactivationStepSchema = z
  .object({
    wait_time_minutes: z
      .number({ message: 'Tempo de espera e obrigatorio' })
      .int('Deve ser um numero inteiro')
      .min(1, 'Minimo 1 minuto')
      .max(10080, 'Maximo 7 dias (10080 minutos)'),
    action_type: z.enum(['send_message', 'close_conversation', 'transfer_to_human'], {
      message: 'Selecione um tipo de acao valido',
    }),
    action_parameter: z.string().max(2000, 'Maximo 2000 caracteres').default(''),
    start_time: z.string().default(''),
    end_time: z.string().default(''),
    tag_ids: z.array(z.string().uuid()).default([]),
  })
  .superRefine((data, ctx) => {
    // action_parameter e opcional para send_message
    // Se vazio, o agente IA gera a mensagem automaticamente

    // start_time e end_time: ambos ou nenhum
    const hasStart = data.start_time.trim() !== '';
    const hasEnd = data.end_time.trim() !== '';
    if (hasStart !== hasEnd) {
      const missingField = hasStart ? 'end_time' : 'start_time';
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Preencha ambos os horarios ou deixe ambos em branco',
        path: [missingField],
      });
    }

    // Validar formato HH:MM
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (hasStart && !timeRegex.test(data.start_time)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Formato invalido (use HH:MM)',
        path: ['start_time'],
      });
    }
    if (hasEnd && !timeRegex.test(data.end_time)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Formato invalido (use HH:MM)',
        path: ['end_time'],
      });
    }
  });

// Schema completo do formulario
export const reactivationFormSchema = z.object({
  settings: reactivationSettingsSchema,
  steps: z
    .array(reactivationStepSchema)
    .min(1, 'Adicione pelo menos 1 etapa de reativacao'),
});

// Type inference
export type ReactivationSettingsFormData = z.infer<typeof reactivationSettingsSchema>;
export type ReactivationStepFormData = z.infer<typeof reactivationStepSchema>;
export type ReactivationFormDataValidated = z.infer<typeof reactivationFormSchema>;
