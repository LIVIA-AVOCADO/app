import { z } from 'zod';

export const upsertConversationTimeoutSchema = z
  .object({
    is_active: z.boolean(),
    ia_inactive_timeout_minutes: z.number().int().positive().nullable().optional(),
    closure_message: z.string().max(1000).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.is_active && !data.ia_inactive_timeout_minutes) return false;
      return true;
    },
    {
      message: 'Informe o tempo de inatividade para ativar o encerramento automático',
      path: ['ia_inactive_timeout_minutes'],
    }
  );

export type UpsertConversationTimeoutInput = z.infer<typeof upsertConversationTimeoutSchema>;

export interface ConversationTimeoutSettings {
  tenant_id: string;
  ia_inactive_timeout_minutes: number | null;
  closure_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
