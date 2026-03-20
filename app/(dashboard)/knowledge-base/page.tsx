import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDomainsWithCount, getBasesByDomain, getDomains } from '@/lib/queries/knowledge-base';
import { KnowledgeBasePageContent } from '@/components/knowledge-base/knowledge-base-page-content';

export default async function KnowledgeBasePage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantId = (userData as any)?.tenant_id;

  if (!tenantId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">
          Erro: Usuário sem tenant associado
        </p>
      </div>
    );
  }

  // Buscar dados do tenant (incluindo neurocore)
  const { data: tenantData } = (await supabase
    .from('tenants')
    .select(
      `
      id,
      neurocore_id,
      neurocores(id, name)
    `
    )
    .eq('id', tenantId)
    .single()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (!tenantData || !tenantData.neurocore_id || !tenantData.neurocores) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">
          Erro: Tenant sem NeuroCore configurado
        </p>
      </div>
    );
  }

  const neurocoreId = tenantData.neurocore_id;

  let domains;
  let allDomains;
  const basesByDomain: Record<string, Awaited<ReturnType<typeof getBasesByDomain>>> = {};
  let error = null;

  try {
    // Buscar domínios com contagem
    domains = await getDomainsWithCount(neurocoreId, tenantId);

    // Buscar todos os domínios (sem contagem) para o select do form
    allDomains = await getDomains(neurocoreId);

    // Buscar bases de cada domínio
    await Promise.all(
      domains.map(async (domain) => {
        const bases = await getBasesByDomain(domain.id, tenantId);
        basesByDomain[domain.id] = bases;
      })
    );
  } catch (e) {
    console.error('Error loading knowledge base:', e);
    error = e;
  }

  if (error || !domains || !allDomains) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">
          Erro ao carregar base de conhecimento. Verifique o console para
          detalhes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-background p-6 w-full">
      <KnowledgeBasePageContent
        domains={domains}
        basesByDomain={basesByDomain}
        allDomains={allDomains}
        tenantId={tenantId}
        neurocoreId={neurocoreId}
      />

      <div className="mt-8 text-sm text-muted-foreground">
        <p>
          💡 <strong>Dica:</strong> Organize suas bases de conhecimento por
          domínios para facilitar o gerenciamento. O conteúdo será
          automaticamente vetorizado pela IA.
        </p>
      </div>
    </div>
  );
}
