import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTagsForManagement } from '@/lib/queries/tags-crud';
import { TagsManager } from '@/components/configuracoes/tags/tags-manager';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Tags | LIVIA',
  description: 'Gerencie as tags do seu tenant',
};

export default async function TagsPage() {
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

  const tags = await getTagsForManagement(tenantId);

  return <TagsManager initialTags={tags} tenantId={tenantId} />;
}
