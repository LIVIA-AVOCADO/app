/**
 * lib/permissions/index.ts
 *
 * Core do sistema de controle de acesso baseado em papéis (RBAC).
 *
 * Princípios SOLID aplicados:
 * - S: módulo dedicado exclusivamente a permissões
 * - O: adicionar nova rota/módulo = adicionar entrada em ROUTE_PERMISSIONS, sem alterar funções
 * - D: consumidores dependem das abstrações exportadas, não de lógica espalhada
 */

// ---------------------------------------------------------------------------
// Constantes de módulos — devem coincidir com feature_modules.key no banco
// ---------------------------------------------------------------------------

export const MODULE_KEYS = {
  LIVECHAT:       'livechat',
  CRM:            'crm',
  KNOWLEDGE_BASE: 'knowledge-base',
  AGENTS:         'agents',
  REATIVACAO:     'reativacao',
  CONFIGURACOES:  'configuracoes',
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

// ---------------------------------------------------------------------------
// Mapa de rota → permissão necessária
// Padrão Open/Closed: nova rota = nova entrada aqui, sem tocar nas funções.
// Ordem importa: padrões mais específicos primeiro.
// ---------------------------------------------------------------------------

interface RoutePermission {
  adminOnly?: boolean;
  moduleKey?: ModuleKey;
}

const ROUTE_PERMISSIONS: Array<{ pattern: string; permission: RoutePermission }> = [
  { pattern: '/gerenciar-usuarios', permission: { adminOnly: true } },
  { pattern: '/financeiro',         permission: { adminOnly: true } },
  { pattern: '/relatorios',         permission: { adminOnly: true } },
  { pattern: '/onboarding',         permission: { adminOnly: true } },
  { pattern: '/livechat',           permission: { moduleKey: MODULE_KEYS.LIVECHAT } },
  { pattern: '/crm',                permission: { moduleKey: MODULE_KEYS.CRM } },
  { pattern: '/knowledge-base',     permission: { moduleKey: MODULE_KEYS.KNOWLEDGE_BASE } },
  { pattern: '/neurocore',          permission: { moduleKey: MODULE_KEYS.KNOWLEDGE_BASE } },
  { pattern: '/meus-agentes',       permission: { moduleKey: MODULE_KEYS.AGENTS } },
  { pattern: '/reativacao',         permission: { moduleKey: MODULE_KEYS.REATIVACAO } },
  { pattern: '/configuracoes',      permission: { moduleKey: MODULE_KEYS.CONFIGURACOES } },
];

// ---------------------------------------------------------------------------
// Funções puras de permissão
// ---------------------------------------------------------------------------

export function isSuperAdmin(role: string): boolean {
  return role === 'super_admin';
}

export function hasModule(modules: string[], key: ModuleKey): boolean {
  return modules.includes(key);
}

function getRoutePermission(pathname: string): RoutePermission | null {
  return ROUTE_PERMISSIONS.find(({ pattern }) => pathname.startsWith(pattern))?.permission ?? null;
}

/**
 * Verifica se o usuário pode acessar a rota.
 * Super admins têm acesso irrestrito a todas as rotas.
 * Rotas sem entrada no mapa são livres para qualquer usuário autenticado.
 */
export function canAccessRoute(
  role: string,
  modules: string[],
  pathname: string,
): boolean {
  if (isSuperAdmin(role)) return true;

  const permission = getRoutePermission(pathname);
  if (!permission) return true;
  if (permission.adminOnly) return false;
  if (permission.moduleKey && !hasModule(modules, permission.moduleKey)) return false;

  return true;
}
