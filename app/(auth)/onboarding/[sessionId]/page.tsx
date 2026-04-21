import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/queries/onboarding';
import { WizardLayout } from '@/components/onboarding/wizard-layout';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function OnboardingWizardPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { sessionId } = await params;
  const session = await getSession(sessionId, user.id);

  if (!session) redirect('/onboarding');

  if (session.status === 'active') redirect('/inbox');

  if (session.status === 'awaiting_channel') {
    redirect(`/onboarding/${sessionId}/channel`);
  }

  return <WizardLayout session={session} />;
}
