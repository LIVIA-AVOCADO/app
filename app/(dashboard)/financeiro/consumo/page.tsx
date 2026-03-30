import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UsageDashboard } from '@/components/billing/usage-dashboard';
import {
  getUsageDaily,
  getUsageSummaryByProvider,
  getUsageTotals,
} from '@/lib/queries/billing';

export const metadata = {
  title: 'Consumo | LIVIA',
  description: 'Analise seu consumo de créditos e uso de IA',
};

/**
 * Página de Consumo / Analytics
 *
 * Exibe gráficos e análises de uso de IA
 */
export default async function ConsumoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  const tenantId = userData?.tenant_id;

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Erro: Usuário sem tenant associado</p>
      </div>
    );
  }

  // Busca dados para 30 dias por padrão
  const [usageDaily, usageSummary, usageTotals] = await Promise.all([
    getUsageDaily(tenantId, 30),
    getUsageSummaryByProvider(tenantId, 30),
    getUsageTotals(tenantId, 30),
  ]);

  return (
    <UsageDashboard
      tenantId={tenantId}
      initialUsageDaily={usageDaily}
      initialUsageSummary={usageSummary}
      initialUsageTotals={usageTotals}
    />
  );
}
