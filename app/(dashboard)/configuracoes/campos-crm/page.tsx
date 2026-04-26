import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FieldsEditor } from '@/components/configuracoes/campos-crm/fields-editor';
import type { ContactFieldDefinition } from '@/types/crm';

export const dynamic = 'force-dynamic';

export default async function CamposCRMPage() {
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

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('contact_field_definitions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('display_order', { ascending: true });

  return (
    <div className="p-6">
      <FieldsEditor initialFields={(data || []) as ContactFieldDefinition[]} />
    </div>
  );
}
