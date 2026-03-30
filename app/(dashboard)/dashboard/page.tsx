import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardData } from '@/lib/queries/dashboard';
import { DashboardContainer } from '@/components/dashboard/dashboard-container';

export const metadata = {
  title: 'Dashboard | LIVIA',
  description: 'Visão geral das métricas e analytics de conversas',
};

export default async function DashboardPage() {
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

  // Carregar dados iniciais (30 dias)
  const initialData = await getDashboardData({
    tenantId,
    daysAgo: 30
  });

  return <DashboardContainer initialData={initialData} tenantId={tenantId} />;
}
