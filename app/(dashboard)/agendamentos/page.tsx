import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAppointments, getUnits, getResources } from '@/lib/queries/scheduling';
import { AgendaContainer } from '@/components/agendamentos/agenda/agenda-container';

export const metadata = {
  title: 'Agendamentos | LIVIA',
  description: 'Visualize e gerencie os agendamentos de clientes',
};

export default async function AgendamentosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Erro: Usuário sem tenant associado</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  const [{ data: appointments, count }, units, resources] = await Promise.all([
    getAppointments(tenantId, { from: today, limit: 50 }),
    getUnits(tenantId),
    getResources(tenantId),
  ]);

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-8">
      <div className="container max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agendamentos</h1>
          <p className="text-muted-foreground">
            Visualize, confirme e gerencie os agendamentos de clientes.
          </p>
        </div>

        <AgendaContainer
          tenantId={tenantId}
          initialAppointments={appointments}
          initialCount={count}
          units={units}
          resources={resources}
        />
      </div>
    </div>
  );
}
