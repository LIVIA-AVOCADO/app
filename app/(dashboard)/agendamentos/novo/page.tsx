import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServices, getUnits, getResources, getSettings } from '@/lib/queries/scheduling';
import { NovoAgendamentoForm } from '@/components/agendamentos/novo/novo-agendamento-form';

export const metadata = {
  title: 'Novo Agendamento | LIVIA',
  description: 'Criar novo agendamento de cliente',
};

export default async function NovoAgendamentoPage() {
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
      <div className="flex items-center justify-center h-screen">
        <p className="text-destructive">Erro: Usuário sem tenant associado</p>
      </div>
    );
  }

  const [services, units, resources, settings] = await Promise.all([
    getServices(tenantId),
    getUnits(tenantId),
    getResources(tenantId, { resourceType: 'staff' }),
    getSettings(tenantId),
  ]);

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-8">
      <div className="container max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Agendamento</h1>
          <p className="text-muted-foreground">
            Selecione o serviço, data e horário para criar um agendamento manual.
          </p>
        </div>

        <NovoAgendamentoForm
          tenantId={tenantId}
          services={services}
          units={units}
          resources={resources}
          settings={settings}
        />
      </div>
    </div>
  );
}
