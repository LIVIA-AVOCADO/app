import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schemas base
// ---------------------------------------------------------------------------

const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Formato inválido — use HH:MM');

export const weeklyIntervalSchema = z
  .object({
    id:              z.string().uuid().optional(), // undefined = novo registro
    day_of_week:     z.number().int().min(0).max(6),
    start_time:      timeStringSchema,
    end_time:        timeStringSchema,
    is_active:       z.boolean().default(true),
    offline_message: z.string().max(500).nullable().optional(),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: 'O horário de fim deve ser posterior ao de início',
    path: ['end_time'],
  });

export const exceptionSchema = z
  .object({
    id:             z.string().uuid().optional(),
    exception_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida — use YYYY-MM-DD'),
    type:           z.enum(['blocked', 'custom']),
    start_time:     timeStringSchema.nullable().optional(),
    end_time:       timeStringSchema.nullable().optional(),
    label:          z.string().max(100).nullable().optional(),
  })
  .refine(
    (d) => d.type === 'blocked' || (d.start_time && d.end_time),
    { message: 'Informe os horários para o tipo personalizado', path: ['start_time'] }
  )
  .refine(
    (d) => d.type === 'blocked' || !d.start_time || !d.end_time || d.end_time > d.start_time,
    { message: 'O horário de fim deve ser posterior ao de início', path: ['end_time'] }
  );

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export type WeeklyIntervalInput = z.infer<typeof weeklyIntervalSchema>;
export type ExceptionInput      = z.infer<typeof exceptionSchema>;

export interface WeeklyInterval extends WeeklyIntervalInput {
  id:         string;
  tenant_id:  string;
  timezone:   string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleException extends ExceptionInput {
  id:         string;
  tenant_id:  string;
  timezone:   string;
  created_at: string;
  updated_at: string;
}

export interface AgentOnlineStatus {
  online:           boolean;
  reason:           string;
  offline_message?: string | null;
}
