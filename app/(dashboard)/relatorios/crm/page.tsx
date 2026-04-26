import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCRMMetrics } from '@/lib/queries/crm-metrics';
import { CRMMetricsView } from '@/components/relatorios/crm-metrics-view';

export const dynamic = 'force-dynamic';

export default async function RelatorioCRMPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .single();

  const tenantId = userData?.tenant_id;
  if (!tenantId) redirect('/login');

  const metrics = await getCRMMetrics(tenantId);

  return <CRMMetricsView metrics={metrics} />;
}
