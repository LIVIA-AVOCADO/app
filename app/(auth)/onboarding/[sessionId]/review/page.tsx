import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/queries/onboarding';
import { ReviewLayout } from '@/components/onboarding/review-layout';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function OnboardingReviewPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { sessionId } = await params;
  const session = await getSession(sessionId, user.id);

  if (!session) redirect('/onboarding');

  if (session.status === 'active') redirect('/inbox');
  if (session.status === 'failed') redirect(`/onboarding/${sessionId}`);

  return <ReviewLayout session={session} />;
}
