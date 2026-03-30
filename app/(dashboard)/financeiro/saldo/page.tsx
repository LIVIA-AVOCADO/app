import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WalletDashboard } from '@/components/billing/wallet-dashboard';
import { getWallet, getUsageSummaryByProvider, getUsageTotals } from '@/lib/queries/billing';

export const metadata = {
  title: 'Saldo & Créditos | LIVIA',
  description: 'Visualize seu saldo e consumo de créditos',
};

/**
 * Página de Saldo & Créditos
 *
 * Princípios SOLID:
 * - Single Responsibility: Exibe saldo e resumo de consumo
 * - Server Component: Busca dados iniciais no servidor
 * - Dependency Inversion: Usa queries abstraídas
 */
export default async function SaldoPage() {
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

  // Busca dados iniciais no servidor
  const [wallet, usageSummary, usageTotals] = await Promise.all([
    getWallet(tenantId),
    getUsageSummaryByProvider(tenantId, 7),
    getUsageTotals(tenantId, 7),
  ]);

  return (
    <WalletDashboard
      tenantId={tenantId}
      initialWallet={wallet}
      initialUsageSummary={usageSummary}
      initialUsageTotals={usageTotals}
    />
  );
}
