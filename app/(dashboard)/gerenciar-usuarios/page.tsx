import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ManageUsersContent } from '@/components/admin/manage-users-content';
import { MODULES_CONFIG } from '@/lib/permissions';

export default async function GerenciarUsuariosPage() {
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

  if (!userData?.tenant_id) {
    redirect('/aguardando-acesso');
  }

  const tenantId = userData.tenant_id;

  const adminClient = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantUsers } = await (adminClient as any)
    .from('users')
    .select('id, full_name, email, avatar_url, modules, role, is_active, is_internal, availability_status')
    .eq('tenant_id', tenantId)
    .eq('is_internal', false)
    .order('full_name');

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <ManageUsersContent
        featureModules={MODULES_CONFIG}
        tenantUsers={tenantUsers || []}
      />
    </div>
  );
}
