import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Separator } from '@/components/ui/separator';
import { EncerramentoForm } from '@/components/configuracoes/encerramento-automatico/encerramento-form';
import { getConversationTimeoutSettings } from '@/lib/queries/conversation-timeout';

export const metadata = {
  title: 'Encerramento Automático | LIVIA',
  description: 'Configure o encerramento automático de conversas por inatividade',
};

export default async function EncerramentoAutomaticoPage() {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantId = (userData as any)?.tenant_id as string | undefined;

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-destructive">Erro: Usuário sem tenant associado</p>
      </div>
    );
  }

  const initialSettings = await getConversationTimeoutSettings(tenantId);

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-8">
      <div className="container max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Encerramento Automático</h1>
          <p className="text-muted-foreground">
            Configure o encerramento automático de conversas por inatividade do cliente
          </p>
        </div>

        <Separator />

        <EncerramentoForm
          tenantId={tenantId}
          userId={user.id}
          initialSettings={initialSettings}
        />
      </div>
    </div>
  );
}
