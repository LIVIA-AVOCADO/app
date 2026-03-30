import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TagsContainer } from '@/components/tags/tags-container';

export const metadata = {
  title: 'Relatório Tags | LIVIA',
  description: 'Análise de categorização por tags',
};

export default async function RelatorioTagsPage() {
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

  return <TagsContainer tenantId={tenantId} />;
}
