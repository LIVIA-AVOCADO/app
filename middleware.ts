import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

/**
 * Middleware de Auth + Assinatura
 *
 * Intercepta rotas do dashboard e verifica:
 * 1. Autenticacao (redireciona para /login se nao autenticado)
 * 2. Associacao a tenant (redireciona para /aguardando-acesso se sem tenant)
 * 3. Status da assinatura (redireciona para /financeiro/recarregar se cancelada)
 *
 * Cache: status da assinatura e lido via cookie 'x-sub-status' com TTL de 5 min.
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

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

function isDashboardRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/financeiro') ||
    pathname.startsWith('/livechat') ||
    pathname.startsWith('/crm') ||
    pathname.startsWith('/knowledge-base') ||
    pathname.startsWith('/neurocore') ||
    pathname.startsWith('/meus-agentes') ||
    pathname.startsWith('/configuracoes') ||
    pathname.startsWith('/reativacao') ||
    pathname.startsWith('/relatorios') ||
    pathname.startsWith('/aguardando-acesso') ||
    pathname.startsWith('/gerenciar-usuarios') ||
    pathname.startsWith('/onboarding')
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
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  const hasTenant = !!userData?.tenant_id;

  if (!hasTenant && !isTenantExemptRoute(pathname)) {
    const waitingUrl = new URL('/aguardando-acesso', request.url);
    return NextResponse.redirect(waitingUrl);
  }

  if (hasTenant && pathname.startsWith('/aguardando-acesso')) {
    const livechatUrl = new URL('/livechat', request.url);
    return NextResponse.redirect(livechatUrl);
  }

  if (!hasTenant) {
    return response;
  }

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
      .eq('id', userData!.tenant_id)
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
    const rechargeUrl = new URL('/financeiro/recarregar', request.url);
    return NextResponse.redirect(rechargeUrl);
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
