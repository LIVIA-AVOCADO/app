/**
 * Queries para as tabelas agent_schedule_weekly e agent_schedule_exceptions.
 * Tabelas novas (não geradas em types/database.ts) — usa cast para any.
 */

import { createClient } from '@/lib/supabase/server';
import type {
  WeeklyInterval,
  ScheduleException,
  AgentOnlineStatus,
} from '@/lib/validations/agent-schedule-validation';

// ---------------------------------------------------------------------------
// Horários semanais
// ---------------------------------------------------------------------------

export async function getWeeklySchedule(tenantId: string): Promise<WeeklyInterval[]> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('agent_schedule_weekly')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('day_of_week', { ascending: true })
    .order('start_time',  { ascending: true });

  if (error) {
    console.error('[getWeeklySchedule] Error:', error);
    throw error;
  }

  return (data ?? []) as WeeklyInterval[];
}

export async function upsertWeeklyInterval(payload: {
  id?:             string;
  tenant_id:       string;
  day_of_week:     number;
  start_time:      string;
  end_time:        string;
  is_active?:      boolean;
  offline_message?: string | null;
}): Promise<WeeklyInterval> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('agent_schedule_weekly')
    .upsert(
      { ...payload, updated_at: new Date().toISOString() },
      { onConflict: payload.id ? 'id' : 'tenant_id,day_of_week,start_time' }
    )
    .select()
    .single();

  if (error) {
    console.error('[upsertWeeklyInterval] Error:', error);
    throw error;
  }

  return data as WeeklyInterval;
}

export async function deleteWeeklyInterval(id: string, tenantId: string): Promise<void> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('agent_schedule_weekly')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[deleteWeeklyInterval] Error:', error);
    throw error;
  }
}

export async function deleteAllWeeklyIntervalsForDay(
  tenantId: string,
  dayOfWeek: number
): Promise<void> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('agent_schedule_weekly')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('day_of_week', dayOfWeek);

  if (error) {
    console.error('[deleteAllWeeklyIntervalsForDay] Error:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Exceções / datas especiais
// ---------------------------------------------------------------------------

export async function getScheduleExceptions(tenantId: string): Promise<ScheduleException[]> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('agent_schedule_exceptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('exception_date', { ascending: true });

  if (error) {
    console.error('[getScheduleExceptions] Error:', error);
    throw error;
  }

  return (data ?? []) as ScheduleException[];
}

export async function upsertScheduleException(payload: {
  id?:             string;
  tenant_id:       string;
  exception_date:  string;
  type:            'blocked' | 'custom';
  start_time?:     string | null;
  end_time?:       string | null;
  label?:          string | null;
}): Promise<ScheduleException> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  if (payload.id) {
    // Atualização de registro existente
    const { id, ...rest } = payload;
    const { data, error } = await sb
      .from('agent_schedule_exceptions')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', payload.tenant_id)
      .select()
      .single();

    if (error) {
      console.error('[upsertScheduleException] Error:', error);
      throw error;
    }
    return data as ScheduleException;
  }

  // Novo registro — insert simples
  const { data, error } = await sb
    .from('agent_schedule_exceptions')
    .insert({ ...payload, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    console.error('[upsertScheduleException] Error:', error);
    throw error;
  }

  return data as ScheduleException;
}

export async function deleteScheduleException(id: string, tenantId: string): Promise<void> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('agent_schedule_exceptions')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[deleteScheduleException] Error:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Status atual (consulta a RPC is_agent_online)
// ---------------------------------------------------------------------------

export async function getAgentOnlineStatus(tenantId: string): Promise<AgentOnlineStatus> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('is_agent_online', {
    p_tenant_id: tenantId,
  });

  if (error) {
    console.error('[getAgentOnlineStatus] Error:', error);
    // Falha segura: assume online
    return { online: true, reason: 'error_fallback' };
  }

  return data as AgentOnlineStatus;
}
