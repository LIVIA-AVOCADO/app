import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RechargePageContent } from '@/components/billing/recharge-page-content';
import { getWallet, getRechargeHistory } from '@/lib/queries/billing';

export const metadata = {
  title: 'Recarregar Créditos | LIVIA',
  description: 'Solicite recarga de créditos para sua conta',
};

/**
 * Página de Recarga de Créditos
 *
 * MVP: Instruções para recarga manual via contato
 */
export default async function RecarregarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id, tenants(name)')
    .eq('id', user.id)
    .single();

  const tenantId = userData?.tenant_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantName = (userData?.tenants as any)?.name || 'Sua Empresa';

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Erro: Usuário sem tenant associado</p>
      </div>
    );
  }

  // Busca dados
  const adminSupabase = createAdminClient();
  const [wallet, rechargeHistory, packagesResult] = await Promise.all([
    getWallet(tenantId),
    getRechargeHistory(tenantId, 10),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminSupabase as any)
      .from('credit_packages')
      .select('id, name, label, price_brl_cents, credits, bonus_credits, is_highlighted')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ]);

  const creditPackages = packagesResult.data || [];

  return (
    <RechargePageContent
      tenantId={tenantId}
      tenantName={tenantName}
      wallet={wallet}
      rechargeHistory={rechargeHistory}
      creditPackages={creditPackages}
    />
  );
}
