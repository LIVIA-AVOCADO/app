import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Separator } from '@/components/ui/separator';
import { ScheduleStatusBadge } from '@/components/configuracoes/horarios-agente/schedule-status-badge';
import { WeeklyScheduleForm } from '@/components/configuracoes/horarios-agente/weekly-schedule-form';
import { ExceptionsManager } from '@/components/configuracoes/horarios-agente/exceptions-manager';
import {
  getWeeklySchedule,
  getScheduleExceptions,
  getAgentOnlineStatus,
} from '@/lib/queries/agent-schedule';

export const metadata = {
  title: 'Horários do Agente | LIVIA',
  description: 'Configure os horários em que o agente de IA estará online',
};

export default async function HorariosAgentePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantId = (userData as any)?.tenant_id as string | undefined;

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-destructive">Erro: Usuário sem tenant associado</p>
      </div>
    );
  }

  const [weeklyIntervals, exceptions, onlineStatus] = await Promise.all([
    getWeeklySchedule(tenantId),
    getScheduleExceptions(tenantId),
    getAgentOnlineStatus(tenantId),
  ]);

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-8">
      <div className="container max-w-4xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Horários do Agente</h1>
          <p className="text-muted-foreground">
            Defina quando o agente de IA estará disponível. Fora do horário configurado,
            as conversas são transferidas automaticamente para um atendente humano.
          </p>
        </div>

        {/* Status atual */}
        <ScheduleStatusBadge status={onlineStatus} large />

        <Separator />

        {/* Horário semanal */}
        <WeeklyScheduleForm savedIntervals={weeklyIntervals} />

        {/* Datas especiais */}
        <ExceptionsManager initialExceptions={exceptions} />
      </div>
    </div>
  );
}
