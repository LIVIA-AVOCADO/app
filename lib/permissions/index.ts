/**
 * lib/permissions/index.ts
 *
 * Core do sistema de controle de acesso baseado em papéis (RBAC).
 *
 * Princípios SOLID aplicados:
 * - S: módulo dedicado exclusivamente a permissões
 * - O: nova rota/módulo = nova entrada em MODULE_KEYS + MODULES_CONFIG + ROUTE_PERMISSIONS
 *      sem alterar nenhuma função existente
 * - D: consumidores dependem das abstrações exportadas, não de lógica espalhada
 *
 * Fonte de verdade dos módulos disponíveis: MODULES_CONFIG (código).
 * Não há dependência da tabela feature_modules do banco para listar módulos.
 * O banco só armazena quais módulos cada usuário possui (users.modules[]).
 */

// ---------------------------------------------------------------------------
// Constantes de módulos
// ---------------------------------------------------------------------------

export const MODULE_KEYS = {
  LIVECHAT:           'livechat',
  CRM:                'crm',
  KNOWLEDGE_BASE:     'knowledge-base',
  AGENTS:             'agents',
  REATIVACAO:         'reativacao',
  CONFIGURACOES:      'configuracoes',
  FINANCEIRO:         'financeiro',
  RELATORIOS:         'relatorios',
  GERENCIAR_USUARIOS: 'gerenciar-usuarios',
  HORARIOS_AGENTE:    'horarios_agente',
  AGENDAMENTOS:       'agendamentos',
  CONEXOES:           'conexoes',
  CONEXOES_VIEW:      'conexoes-view',
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

// ---------------------------------------------------------------------------
// Configuração dos módulos — substitui a tabela feature_modules do banco.
// Adicionar novo módulo = adicionar entrada aqui. Zero dependência de DB.
// ---------------------------------------------------------------------------

export interface ModuleConfig {
  key: ModuleKey;
  name: string;
  description: string;
}

export const MODULES_CONFIG: ModuleConfig[] = [
  {
    key:         MODULE_KEYS.LIVECHAT,
    name:        'Livechat',
    description: 'Acesso à caixa de entrada e atendimento de conversas',
  },
  {
    key:         MODULE_KEYS.CRM,
    name:        'CRM',
    description: 'Gestão de contatos e funil de vendas',
  },
  {
    key:         MODULE_KEYS.KNOWLEDGE_BASE,
    name:        'Base de Conhecimento',
    description: 'Gerenciamento de bases e validação de respostas da IA',
  },
  {
    key:         MODULE_KEYS.AGENTS,
    name:        'Agentes IA',
    description: 'Criação e configuração de agentes de inteligência artificial',
  },
  {
    key:         MODULE_KEYS.REATIVACAO,
    name:        'Reativação',
    description: 'Regras e configurações de reativação automática de conversas',
  },
  {
    key:         MODULE_KEYS.CONFIGURACOES,
    name:        'Configurações',
    description: 'Tags, controle da IA e demais configurações do workspace',
  },
  {
    key:         MODULE_KEYS.FINANCEIRO,
    name:        'Financeiro',
    description: 'Saldo, créditos, consumo e extrato financeiro',
  },
  {
    key:         MODULE_KEYS.RELATORIOS,
    name:        'Relatórios',
    description: 'Relatórios de conversas, tags e desempenho da equipe',
  },
  {
    key:         MODULE_KEYS.GERENCIAR_USUARIOS,
    name:        'Gerenciar Usuários',
    description: 'Associação e controle de acesso dos usuários da equipe',
  },
  {
    key:         MODULE_KEYS.HORARIOS_AGENTE,
    name:        'Horários do Agente',
    description: 'Configuração dos horários de disponibilidade do agente de IA',
  },
  {
    key:         MODULE_KEYS.AGENDAMENTOS,
    name:        'Agendamentos',
    description: 'Agendamento de clientes — multi-nicho (clínicas, ISP, laboratórios, etc.)',
  },
  {
    key:         MODULE_KEYS.CONEXOES,
    name:        'Conexões',
    description: 'Gerenciamento completo de conexões de API (reconectar, reiniciar, desconectar)',
  },
  {
    key:         MODULE_KEYS.CONEXOES_VIEW,
    name:        'Conexões (visualização)',
    description: 'Visualização do status das conexões de API sem permissão para executar ações',
  },
];

// ---------------------------------------------------------------------------
// Mapa de rota → módulo necessário
// Padrão Open/Closed: nova rota protegida = nova entrada aqui.
// Ordem importa: padrões mais específicos primeiro.
// adminOnly reservado apenas para /onboarding (fluxo de criação de tenant).
// ---------------------------------------------------------------------------

interface RoutePermission {
  adminOnly?: boolean;
  moduleKey?: ModuleKey;
  /** Passa se o usuário tiver QUALQUER um dos módulos listados. */
  anyModuleKey?: ModuleKey[];
}

const ROUTE_PERMISSIONS: Array<{ pattern: string; permission: RoutePermission }> = [
  { pattern: '/onboarding',         permission: { adminOnly: true } },
  { pattern: '/gerenciar-usuarios', permission: { moduleKey: MODULE_KEYS.GERENCIAR_USUARIOS } },
  { pattern: '/financeiro',         permission: { moduleKey: MODULE_KEYS.FINANCEIRO } },
  { pattern: '/relatorios',         permission: { moduleKey: MODULE_KEYS.RELATORIOS } },
  { pattern: '/inbox',              permission: { moduleKey: MODULE_KEYS.LIVECHAT } },
  { pattern: '/crm',                permission: { moduleKey: MODULE_KEYS.CRM } },
  { pattern: '/knowledge-base',     permission: { moduleKey: MODULE_KEYS.KNOWLEDGE_BASE } },
  { pattern: '/neurocore',          permission: { moduleKey: MODULE_KEYS.KNOWLEDGE_BASE } },
  { pattern: '/meus-agentes',       permission: { moduleKey: MODULE_KEYS.AGENTS } },
  { pattern: '/reativacao',         permission: { moduleKey: MODULE_KEYS.REATIVACAO } },
  { pattern: '/configuracoes/horarios-agente', permission: { moduleKey: MODULE_KEYS.HORARIOS_AGENTE } },
  { pattern: '/configuracoes/conexoes',        permission: { anyModuleKey: [MODULE_KEYS.CONEXOES, MODULE_KEYS.CONEXOES_VIEW] } },
  { pattern: '/configuracoes',                permission: { moduleKey: MODULE_KEYS.CONFIGURACOES } },
  { pattern: '/agendamentos',                 permission: { moduleKey: MODULE_KEYS.AGENDAMENTOS } },
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
  if (permission.anyModuleKey && !permission.anyModuleKey.some((key) => hasModule(modules, key))) return false;

  return true;
}
