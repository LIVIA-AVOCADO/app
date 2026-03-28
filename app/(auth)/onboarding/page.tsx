import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveTemplates, getUserLatestSession } from '@/lib/queries/onboarding';
import { OnboardingEntryForm } from '@/components/onboarding/entry-form';

export const metadata = {
  title: 'Configurar Workspace | LIVIA',
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id, full_name, email')
    .eq('id', user.id)
    .single();

  if (userData?.tenant_id) redirect('/livechat');

  const [templatesByNiche, latestSession] = await Promise.all([
    getActiveTemplates(),
    getUserLatestSession(user.id),
  ]);

  return (
    <OnboardingEntryForm
      templatesByNiche={templatesByNiche}
      latestSession={latestSession}
      userName={userData?.full_name || user.user_metadata?.full_name || 'Usuário'}
      userEmail={userData?.email || user.email || ''}
    />
  );
}
