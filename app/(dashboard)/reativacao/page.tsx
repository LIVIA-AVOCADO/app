import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ReactivationPage } from '@/components/reactivation/reactivation-page';
import {
  getReactivationSettings,
  getReactivationSteps,
  getAvailableTagsForTenant,
} from '@/lib/queries/reactivation';

export const metadata = {
  title: 'Reativacao | LIVIA',
  description: 'Configure as regras de reativacao automatica de conversas',
};

export default async function ReativacaoPage() {
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
        <p className="text-destructive">Erro: Usuario sem tenant associado</p>
      </div>
    );
  }

  const [settings, steps, availableTags] = await Promise.all([
    getReactivationSettings(tenantId),
    getReactivationSteps(tenantId),
    getAvailableTagsForTenant(tenantId),
  ]);

  return (
    <ReactivationPage
      initialData={{
        settings,
        steps,
        availableTags,
      }}
    />
  );
}
