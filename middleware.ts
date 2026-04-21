import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { canAccessRoute } from '@/lib/permissions';

/**
 * Middleware de Auth + Permissões + Assinatura
 *
 * Intercepta rotas do dashboard e verifica (nesta ordem):
 * 1. Autenticação   → redireciona para /login se não autenticado
 * 2. Aceite termos  → redireciona para /aceitar-termos se pendente
 * 3. Tenant         → redireciona para /aguardando-acesso se sem tenant
 * 4. Permissão RBAC → redireciona para /perfil se role/módulo insuficiente
 * 5. Assinatura     → redireciona para /financeiro/recarregar se cancelada
 *
 * Performance:
 * - getSession() lê sessão dos cookies sem HTTP call (getUser() chamava o servidor sempre)
 * - Dados do usuário em cookie x-user-ctx (HTTPOnly, TTL 5 min) — zero query ao banco
 *   na esmagadora maioria dos requests; re-busca apenas quando o cookie expira
 * - Status da assinatura em cookie x-sub-status (HTTPOnly, TTL 5 min) — já existia
 */


const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/auth/callback',
  '/api/stripe/webhook',
  '/api/auth/signup',
  '/financeiro/checkout',
];

const TENANT_EXEMPT_ROUTES = ['/aguardando-acesso', '/perfil', '/onboarding'];

const SUBSCRIPTION_CACHE_TTL_SECONDS = 300;
const USER_CTX_CACHE_TTL_SECONDS = 300;
const USER_CTX_COOKIE = 'x-user-ctx';

/** Dados do usuário cacheados no cookie HTTPOnly para evitar query ao banco. */
interface UserCtx {
  uid: string;
  tid: string | null;   // tenant_id
  role: string;
  mods: string[];       // modules
  terms: string | null; // terms_accepted_at
}

function parseUserCtx(raw: string): UserCtx | null {
  try {
    return JSON.parse(atob(raw)) as UserCtx;
  } catch {
    return null;
  }
}

function serializeUserCtx(ctx: UserCtx): string {
  return btoa(JSON.stringify(ctx));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

function isDashboardRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/financeiro') ||
    pathname.startsWith('/inbox') ||
    pathname.startsWith('/crm') ||
    pathname.startsWith('/knowledge-base') ||
    pathname.startsWith('/neurocore') ||
    pathname.startsWith('/meus-agentes') ||
    pathname.startsWith('/configuracoes') ||
    pathname.startsWith('/reativacao') ||
    pathname.startsWith('/relatorios') ||
    pathname.startsWith('/aguardando-acesso') ||
    pathname.startsWith('/gerenciar-usuarios') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/agendamentos')
  );
}

function isTenantExemptRoute(pathname: string): boolean {
  return TENANT_EXEMPT_ROUTES.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname) || !isDashboardRoute(pathname)) {
    return NextResponse.next();
  }

  if (pathname === '/financeiro/recarregar') {
    return NextResponse.next();
  }

  try {
    return await handleDashboardMiddleware(request, pathname);
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

async function handleDashboardMiddleware(request: NextRequest, pathname: string) {
  let response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ── 1. Auth: sessão lida dos cookies sem HTTP call ───────────────────────
  // getSession() lê o token dos cookies localmente (ao contrário de getUser() que
  // sempre faz uma chamada HTTP ao servidor Supabase). A validade real do token é
  // verificada pelo Supabase quando qualquer chamada de API é executada.
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const userId = session.user.id;

  // ── 2. User context: cookie HTTPOnly, TTL 5 min ──────────────────────────
  // Elimina a query ao banco em cada request.
  // Cache miss (primeira visita ou expirado): 1 query → cookie setado por 5 min.
  const cachedRaw = request.cookies.get(USER_CTX_COOKIE)?.value;
  const cached = cachedRaw ? parseUserCtx(cachedRaw) : null;

  let userCtx: UserCtx;

  if (cached?.uid === userId) {
    userCtx = cached;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dbUser } = await (supabase as any)
      .from('users')
      .select('tenant_id, terms_accepted_at, role, modules')
      .eq('id', userId)
      .single();

    userCtx = {
      uid: userId,
      tid: dbUser?.tenant_id ?? null,
      role: dbUser?.role ?? 'user',
      mods: (dbUser?.modules as string[]) ?? [],
      terms: dbUser?.terms_accepted_at ?? null,
    };

    response.cookies.set(USER_CTX_COOKIE, serializeUserCtx(userCtx), {
      maxAge: USER_CTX_CACHE_TTL_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }

  // ── 3. Aceite de termos ──────────────────────────────────────────────────
  if (!userCtx.terms && pathname !== '/aceitar-termos') {
    return NextResponse.redirect(new URL('/aceitar-termos', request.url));
  }

  // ── 4. Tenant ────────────────────────────────────────────────────────────
  if (!userCtx.tid && !isTenantExemptRoute(pathname)) {
    return NextResponse.redirect(new URL('/aguardando-acesso', request.url));
  }

  if (userCtx.tid && pathname.startsWith('/aguardando-acesso')) {
    return NextResponse.redirect(new URL('/inbox', request.url));
  }

  if (!userCtx.tid) {
    return response;
  }

  // ── 5. RBAC ──────────────────────────────────────────────────────────────
  if (!canAccessRoute(userCtx.role, userCtx.mods, pathname)) {
    return NextResponse.redirect(new URL('/perfil', request.url));
  }

  // ── 6. Assinatura (cookie x-sub-status, sem mudança) ────────────────────
  const cachedStatus = request.cookies.get('x-sub-status')?.value;
  const cachedPeriodEnd = request.cookies.get('x-sub-period-end')?.value;

  const shouldRefresh = !cachedStatus || cachedStatus === 'inactive';
  let subscriptionStatus: string | null = cachedStatus || null;
  let periodEnd: string | null = cachedPeriodEnd || null;

  if (shouldRefresh) {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: tenant } = await adminClient
      .from('tenants')
      .select('subscription_status, subscription_current_period_end')
      .eq('id', userCtx.tid)
      .single();

    subscriptionStatus = tenant?.subscription_status || 'inactive';
    periodEnd = tenant?.subscription_current_period_end || null;

    response.cookies.set('x-sub-status', subscriptionStatus!, {
      maxAge: SUBSCRIPTION_CACHE_TTL_SECONDS,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    if (periodEnd) {
      response.cookies.set('x-sub-period-end', periodEnd, {
        maxAge: SUBSCRIPTION_CACHE_TTL_SECONDS,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
    }
  }

  if (subscriptionStatus === 'canceled' || subscriptionStatus === 'inactive') {
    return NextResponse.redirect(new URL('/financeiro/recarregar', request.url));
  }

  if (subscriptionStatus === 'past_due') {
    response.headers.set('X-Subscription-Warning', 'past_due');
  }

  if (subscriptionStatus) {
    response.headers.set('X-Subscription-Status', subscriptionStatus);
  }
  if (periodEnd) {
    response.headers.set('X-Subscription-Period-End', periodEnd);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
