import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServices, getUnits, getResources, getSettings } from '@/lib/queries/scheduling';
import { AgendamentosConfiguracoes } from '@/components/agendamentos/configuracoes/agendamentos-configuracoes';

export const metadata = {
  title: 'Configurações de Agendamentos | LIVIA',
  description: 'Configure serviços, recursos, unidades e disponibilidade',
};

export default async function AgendamentosConfiguracoesPage() {
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

  const [services, units, resources, settings] = await Promise.all([
    getServices(tenantId, { onlyActive: false }),
    getUnits(tenantId),
    getResources(tenantId),
    getSettings(tenantId),
  ]);

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-8">
      <div className="container max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações de Agendamentos</h1>
          <p className="text-muted-foreground">
            Gerencie serviços, recursos, unidades, disponibilidade e automações.
          </p>
        </div>

        <AgendamentosConfiguracoes
          tenantId={tenantId}
          initialServices={services}
          initialUnits={units}
          initialResources={resources}
          initialSettings={settings}
        />
      </div>
    </div>
  );
}
