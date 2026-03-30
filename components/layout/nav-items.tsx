import { MessageSquare, BookOpen, Bot, BarChart3, Wallet, Settings, Rocket, Calendar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULE_KEYS, type ModuleKey, isSuperAdmin, hasModule } from '@/lib/permissions';
// MODULE_KEYS é a fonte de verdade — não há necessidade de seed no banco para novos módulos.

/**
 * Tipo para subitems de navegação
 *
 * Princípio Interface Segregation (SOLID):
 * moduleKey e adminOnly são opcionais — itens sem restrição não precisam declará-los.
 */
export interface NavSubItem {
  title: string;
  url: string;
  moduleKey?: ModuleKey;
  anyModuleKey?: ModuleKey[];
  adminOnly?: boolean;
}

/**
 * Tipo para items de navegação do sidebar
 *
 * Princípio Open/Closed (SOLID):
 * Extensível via moduleKey/adminOnly sem alterar a lógica de renderização.
 */
export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: string | number;
  moduleKey?: ModuleKey;
  anyModuleKey?: ModuleKey[];
  adminOnly?: boolean;
  items?: NavSubItem[];
}

/**
 * Configuração dos items de navegação do LIVIA.
 *
 * Regras:
 * - adminOnly: true  → visível apenas para super_admin
 * - moduleKey: 'x'   → visível para super_admin ou para user com módulo 'x'
 * - sem restrição    → visível para qualquer usuário autenticado com tenant
 *
 * Princípio Single Responsibility (SOLID):
 * Arquivo dedicado apenas à configuração declarativa de navegação.
 */
export const navItems: NavItem[] = [
  {
    title:     'Onboarding',
    url:       '/onboarding',
    icon:      Rocket,
    badge:     'NEW',
    adminOnly: true,
  },
  {
    title:     'Livechat',
    url:       '/livechat',
    icon:      MessageSquare,
    moduleKey: MODULE_KEYS.LIVECHAT,
  },
  {
    title:     'Base de Conhecimento',
    url:       '/knowledge-base',
    icon:      BookOpen,
    moduleKey: MODULE_KEYS.KNOWLEDGE_BASE,
    items: [
      { title: 'Gerenciar Bases',    url: '/knowledge-base', moduleKey: MODULE_KEYS.KNOWLEDGE_BASE },
      { title: 'Validar Respostas',  url: '/neurocore',      moduleKey: MODULE_KEYS.KNOWLEDGE_BASE },
    ],
  },
  {
    title:     'Meus Agentes IA',
    url:       '/meus-agentes',
    icon:      Bot,
    moduleKey: MODULE_KEYS.AGENTS,
  },
  {
    title:     'Agendamentos',
    url:       '/agendamentos',
    icon:      Calendar,
    moduleKey: MODULE_KEYS.AGENDAMENTOS,
    items: [
      { title: 'Agenda',           url: '/agendamentos',               moduleKey: MODULE_KEYS.AGENDAMENTOS },
      { title: 'Novo Agendamento', url: '/agendamentos/novo',          moduleKey: MODULE_KEYS.AGENDAMENTOS },
      { title: 'Configurações',    url: '/agendamentos/configuracoes', moduleKey: MODULE_KEYS.AGENDAMENTOS },
    ],
  },
  {
    // Pai sem restrição: visibilidade determinada pelos subitens visíveis
    title: 'Configurações',
    url:   '/reativacao',
    icon:  Settings,
    items: [
      { title: 'Reativação',        url: '/reativacao',              moduleKey: MODULE_KEYS.REATIVACAO },
      { title: 'Tags',              url: '/configuracoes/tags',       moduleKey: MODULE_KEYS.CONFIGURACOES },
      { title: 'Controle da IA',           url: '/configuracoes/controle-ia',             moduleKey: MODULE_KEYS.CONFIGURACOES },
      { title: 'Encerramento Automático',  url: '/configuracoes/encerramento-automatico', moduleKey: MODULE_KEYS.CONFIGURACOES },
      { title: 'Horários do Agente',       url: '/configuracoes/horarios-agente',         moduleKey: MODULE_KEYS.HORARIOS_AGENTE },
      { title: 'Conexões', url: '/configuracoes/conexoes', anyModuleKey: [MODULE_KEYS.CONEXOES, MODULE_KEYS.CONEXOES_VIEW] },
      { title: 'Gerenciar Usuários', url: '/gerenciar-usuarios',     moduleKey: MODULE_KEYS.GERENCIAR_USUARIOS },
    ],
  },
  {
    title:     'Relatórios',
    url:       '/relatorios/principal',
    icon:      BarChart3,
    moduleKey: MODULE_KEYS.RELATORIOS,
    items: [
      { title: 'Principal',  url: '/relatorios/principal',  moduleKey: MODULE_KEYS.RELATORIOS },
      { title: 'Conversas',  url: '/relatorios/conversas',  moduleKey: MODULE_KEYS.RELATORIOS },
      { title: 'Tags',       url: '/relatorios/tags',       moduleKey: MODULE_KEYS.RELATORIOS },
    ],
  },
  {
    title:     'Financeiro',
    url:       '/financeiro/saldo',
    icon:      Wallet,
    moduleKey: MODULE_KEYS.FINANCEIRO,
    items: [
      { title: 'Saldo & Créditos', url: '/financeiro/saldo',      moduleKey: MODULE_KEYS.FINANCEIRO },
      { title: 'Consumo',          url: '/financeiro/consumo',     moduleKey: MODULE_KEYS.FINANCEIRO },
      { title: 'Extrato',          url: '/financeiro/extrato',     moduleKey: MODULE_KEYS.FINANCEIRO },
      { title: 'Recarregar',       url: '/financeiro/recarregar',  moduleKey: MODULE_KEYS.FINANCEIRO },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers de visibilidade — usados pelo AppSidebar
// ---------------------------------------------------------------------------

export function isNavItemVisible(
  adminOnly: boolean | undefined,
  moduleKey: ModuleKey | undefined,
  isAdmin: boolean,
  modules: string[],
  anyModuleKey?: ModuleKey[],
): boolean {
  if (adminOnly && !isAdmin) return false;
  if (moduleKey && !isAdmin && !hasModule(modules, moduleKey)) return false;
  if (anyModuleKey && !isAdmin && !anyModuleKey.some((k) => hasModule(modules, k))) return false;
  return true;
}

export function filterNavItems(
  items: NavItem[],
  role: string,
  modules: string[],
): NavItem[] {
  const isAdmin = isSuperAdmin(role);
  return items.reduce<NavItem[]>((acc, item) => {
    if (item.items) {
      const visibleSubs = item.items.filter((sub: NavSubItem) =>
        isNavItemVisible(sub.adminOnly, sub.moduleKey, isAdmin, modules, sub.anyModuleKey)
      );
      if (visibleSubs.length === 0) return acc;
      acc.push({ ...item, items: visibleSubs, url: visibleSubs[0]?.url ?? item.url });
      return acc;
    }
    if (!isNavItemVisible(item.adminOnly, item.moduleKey, isAdmin, modules, item.anyModuleKey)) return acc;
    acc.push(item);
    return acc;
  }, []);
}
