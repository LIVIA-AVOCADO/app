import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getContactWithDetails } from '@/lib/queries/contacts';
import { ContactProfile } from '@/components/contacts/contact-profile';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;

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

  const details = await getContactWithDetails(id, tenantId);
  if (!details) notFound();

  return (
    <ContactProfile
      contact={details.contact}
      conversations={details.conversations}
      notes={details.notes}
      fieldDefs={details.fieldDefs}
      fieldValues={details.fieldValues}
    />
  );
}
