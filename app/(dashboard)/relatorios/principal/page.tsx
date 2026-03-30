import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardContainer } from '@/components/dashboard/dashboard-container';

export const metadata = {
  title: 'Relatório Principal | LIVIA',
  description: 'Visão geral das métricas e analytics de conversas',
};

export default async function RelatorioPrincipalPage() {
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

  return <DashboardContainer initialData={null} tenantId={tenantId} />;
}
