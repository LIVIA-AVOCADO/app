'use server';

import { createClient } from '@/lib/supabase/server';
import {
  weeklyIntervalSchema,
  exceptionSchema,
  type WeeklyIntervalInput,
  type ExceptionInput,
} from '@/lib/validations/agent-schedule-validation';
import {
  upsertWeeklyInterval,
  deleteWeeklyInterval,
  deleteAllWeeklyIntervalsForDay,
  upsertScheduleException,
  deleteScheduleException,
} from '@/lib/queries/agent-schedule';

// ---------------------------------------------------------------------------
// Helper: valida auth + retorna tenant_id do usuário autenticado
// ---------------------------------------------------------------------------

async function getAuthenticatedTenantId(): Promise<
  { tenantId: string; error?: never } | { tenantId?: never; error: string }
> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Não autorizado' };

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  if (userError || !userData) return { error: 'Usuário não encontrado' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { tenant_id, role } = userData as any;

  if (!tenant_id && role !== 'super_admin') {
    return { error: 'Usuário não associado a nenhum tenant' };
  }

  return { tenantId: tenant_id };
}

// ---------------------------------------------------------------------------
// Horários semanais
// ---------------------------------------------------------------------------

export async function saveWeeklyIntervalAction(input: WeeklyIntervalInput) {
  const auth = await getAuthenticatedTenantId();
  if (auth.error) return { error: auth.error };

  const parsed = weeklyIntervalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  try {
    const saved = await upsertWeeklyInterval({
      ...parsed.data,
      tenant_id: auth.tenantId!,
    });
    return { success: true, data: saved };
  } catch {
    return { error: 'Erro ao salvar horário' };
  }
}

export async function deleteWeeklyIntervalAction(id: string) {
  const auth = await getAuthenticatedTenantId();
  if (auth.error) return { error: auth.error };

  try {
    await deleteWeeklyInterval(id, auth.tenantId!);
    return { success: true };
  } catch {
    return { error: 'Erro ao excluir horário' };
  }
}

/**
 * Salva todos os intervalos de um dia de forma atômica:
 * deleta os existentes e reinsere os novos.
 * Usado pelo formulário semanal quando o usuário salva um dia inteiro.
 */
export async function saveDayIntervalsAction(
  dayOfWeek: number,
  intervals: Array<Omit<WeeklyIntervalInput, 'day_of_week'>>
) {
  const auth = await getAuthenticatedTenantId();
  if (auth.error) return { error: auth.error };

  try {
    // Remove todos os intervalos do dia
    await deleteAllWeeklyIntervalsForDay(auth.tenantId!, dayOfWeek);

    // Insere os novos (se houver)
    for (const interval of intervals) {
      const parsed = weeklyIntervalSchema.safeParse({ ...interval, day_of_week: dayOfWeek });
      if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };

      await upsertWeeklyInterval({ ...parsed.data, tenant_id: auth.tenantId! });
    }

    return { success: true };
  } catch {
    return { error: 'Erro ao salvar horários do dia' };
  }
}

// ---------------------------------------------------------------------------
// Exceções / datas especiais
// ---------------------------------------------------------------------------

export async function saveScheduleExceptionAction(input: ExceptionInput) {
  const auth = await getAuthenticatedTenantId();
  if (auth.error) return { error: auth.error };

  const parsed = exceptionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  try {
    const saved = await upsertScheduleException({
      ...parsed.data,
      tenant_id: auth.tenantId!,
    });
    return { success: true, data: saved };
  } catch {
    return { error: 'Erro ao salvar exceção' };
  }
}

export async function deleteScheduleExceptionAction(id: string) {
  const auth = await getAuthenticatedTenantId();
  if (auth.error) return { error: auth.error };

  try {
    await deleteScheduleException(id, auth.tenantId!);
    return { success: true };
  } catch {
    return { error: 'Erro ao excluir exceção' };
  }
}
