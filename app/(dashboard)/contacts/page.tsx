import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getContactsPage } from '@/lib/queries/contacts';
import { ContactListView } from '@/components/contacts/contact-list-view';

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function ContactsPage({ searchParams }: Props) {
  const { q = '', page: pageStr = '1' } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .single();

  const tenantId = userData?.tenant_id;
  if (!tenantId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Erro: Usuário sem tenant associado</p>
      </div>
    );
  }

  const result = await getContactsPage(tenantId, q, page);

  return (
    <ContactListView
      initialContacts={result.contacts}
      initialTotal={result.total}
      initialPage={result.page}
      totalPages={result.totalPages}
    />
  );
}
