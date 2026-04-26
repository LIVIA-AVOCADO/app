import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout';
import { SidebarAutoCollapseWrapper } from '@/components/layout/sidebar-auto-collapse-wrapper';
import { QueryProvider } from '@/providers/query-provider';
import { SubscriptionWarningBanner } from '@/components/layout/subscription-warning-banner';
import { AvailabilityDialogWrapper } from '@/components/layout/availability-dialog-wrapper';

/**
 * Layout do Dashboard (rotas autenticadas)
 *
 * Princípios SOLID:
 * - Single Responsibility: Gerencia layout de rotas autenticadas
 * - Open/Closed: Extensível via SidebarProvider props
 *
 * Features:
 * - Autenticação obrigatória
 * - Sidebar com auto-collapse no livechat
 * - Toggle integrado no header do sidebar (sempre acessível)
 * - Footer do sidebar com perfil clicável
 * - SidebarInset para conteúdo principal (sem padding lateral global — cada página define o seu)
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let supabase;
  let authData;

  try {
    supabase = await createClient();
    const result = await supabase.auth.getUser();
    authData = result.data;

    // Redireciona para login se não autenticado ou se o token está corrompido
    if (result.error || !authData.user) {
      redirect('/login');
    }
  } catch (e) {
    if (isRedirectError(e)) throw e;
    redirect('/login');
  }

  // Busca dados do usuário e tenant (inclui role e modules para RBAC)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData, error: userDataError } = await (supabase as any)
    .from('users')
    .select('tenant_id, full_name, email, avatar_url, role, modules, availability_status, tenants(name)')
    .eq('id', authData!.user!.id)
    .single();

  if (userDataError) {
    console.error('[layout] users query failed:', JSON.stringify(userDataError));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = userData as any;
  const tenantName = user?.tenants?.name;

  // Fetch subscription status for warning banner + disconnected channels count
  let subscriptionStatus: string | null = null;
  let subscriptionPeriodEnd: string | null = null;
  let disconnectedChannelsCount = 0;
  if (user?.tenant_id) {
    const adminClient = createAdminClient();
    const [tenantRes, disconnectedRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adminClient as any)
        .from('tenants')
        .select('subscription_status, subscription_current_period_end')
        .eq('id', user.tenant_id)
        .single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adminClient as any)
        .from('channels')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', user.tenant_id)
        .eq('connection_status', 'disconnected')
        .eq('is_active', true),
    ]);
    subscriptionStatus    = tenantRes.data?.subscription_status || null;
    subscriptionPeriodEnd = tenantRes.data?.subscription_current_period_end || null;
    disconnectedChannelsCount = disconnectedRes.count ?? 0;
  }

  return (
    <QueryProvider>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar
          userName={user?.full_name || 'Usuário'}
          tenantName={tenantName}
          avatarUrl={user?.avatar_url}
          hasTenant={!!user?.tenant_id}
          userRole={user?.role ?? 'user'}
          userModules={user?.modules ?? []}
          availabilityStatus={user?.availability_status ?? 'offline'}
          disconnectedChannelsCount={disconnectedChannelsCount}
        />
        <SidebarInset className="flex min-h-0 flex-col w-full h-screen overflow-hidden bg-surface">
          {user?.role !== 'super_admin' &&
            user?.modules?.includes('livechat') &&
            user?.availability_status === 'offline' && (
              <AvailabilityDialogWrapper />
            )}
          <SubscriptionWarningBanner
            subscriptionStatus={subscriptionStatus}
            periodEnd={subscriptionPeriodEnd}
          />
          <SidebarAutoCollapseWrapper>
            {/* min-h-0: permite o filho encolher no flex; sem isso o conteúdo alto cria scroll duplo (viewport + este div) */}
            <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {children}
            </div>
          </SidebarAutoCollapseWrapper>
        </SidebarInset>
      </SidebarProvider>
    </QueryProvider>
  );
}
