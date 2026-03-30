import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AIControl } from '@/components/profile/ai-control';

export const metadata = {
  title: 'Controle da IA | LIVIA',
  description: 'Gerencie o comportamento da assistente virtual',
};

export default async function ControleIAPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id, tenants(ia_active)')
    .eq('id', user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userAny = userData as any;
  const tenantId = userAny?.tenant_id;
  const aiPaused = !(userAny?.tenants?.ia_active ?? true);

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Erro: Usuário sem tenant associado</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-8">
      <div className="container max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Controle da IA</h1>
          <p className="text-muted-foreground">
            Gerencie o comportamento da assistente virtual
          </p>
        </div>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Assistente Virtual</CardTitle>
            <CardDescription>
              Pause ou retome a IA para todas as conversas do seu tenant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AIControl
              userId={user.id}
              tenantId={tenantId}
              initialPaused={aiPaused}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
