import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/queries/onboarding';
import { OnboardingChat } from '@/components/onboarding/chat/onboarding-chat';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function OnboardingChatPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { sessionId } = await params;
  const session = await getSession(sessionId, user.id);

  if (!session) redirect('/onboarding');
  if (session.status === 'active') redirect('/inbox');

  const { data: userData } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const company = session.payload?.company ?? {};

  return (
    <OnboardingChat
      sessionId={sessionId}
      userName={userData?.full_name || user.user_metadata?.full_name || 'Usuário'}
      company={{
        name:           company.trade_name     ?? '',
        niche:          company.niche          ?? '',
        employee_count: company.employee_count ?? '',
        website:        company.website        ?? null,
      }}
    />
  );
}
