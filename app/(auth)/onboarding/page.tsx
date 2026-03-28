import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveTemplates, getUserLatestSession } from '@/lib/queries/onboarding';
import { TemplateSelector } from '@/components/onboarding/template-selector';

export const metadata = {
  title: 'Onboarding | LIVIA',
  description: 'Configure seu workspace de atendimento com IA',
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  // Usuário já tem tenant ativo — redireciona para o dashboard
  if (userData?.tenant_id) {
    redirect('/livechat');
  }

  const [templatesByNiche, latestSession] = await Promise.all([
    getActiveTemplates(),
    getUserLatestSession(user.id),
  ]);

  return (
    <TemplateSelector
      templatesByNiche={templatesByNiche}
      latestSession={latestSession}
    />
  );
}
