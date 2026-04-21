import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaitingAccessContent } from '@/components/auth/waiting-access-content';

export default async function AguardandoAcessoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id, full_name, email, invite_code')
    .eq('id', user.id)
    .single();

  if (userData?.tenant_id) {
    redirect('/inbox');
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <WaitingAccessContent
        fullName={userData?.full_name || user.user_metadata?.full_name || 'Usuário'}
        email={userData?.email || user.email || ''}
        inviteCode={userData?.invite_code || null}
      />
    </div>
  );
}
