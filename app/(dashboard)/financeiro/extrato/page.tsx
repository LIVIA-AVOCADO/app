import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LedgerContainer } from '@/components/billing/ledger-container';
import { getLedgerEntries, getUsedProviders } from '@/lib/queries/billing';

export const metadata = {
  title: 'Extrato | LIVIA',
  description: 'Visualize seu extrato de créditos e débitos',
};

/**
 * Página de Extrato
 *
 * Princípios SOLID:
 * - Single Responsibility: Exibe histórico de transações
 * - Server Component: Busca dados iniciais no servidor
 */
export default async function ExtratoPage() {
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

  // Busca dados iniciais
  const [ledgerResult, providers] = await Promise.all([
    getLedgerEntries(tenantId, {}, 20, 1),
    getUsedProviders(tenantId),
  ]);

  return (
    <LedgerContainer
      tenantId={tenantId}
      initialData={ledgerResult}
      availableProviders={providers}
    />
  );
}
