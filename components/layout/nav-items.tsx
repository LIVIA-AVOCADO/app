import { MessageSquare, BookOpen, Kanban, Bot, BarChart3, Wallet, Settings, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULE_KEYS, type ModuleKey } from '@/lib/permissions';
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
    title:     'CRM',
    url:       '/crm',
    icon:      Kanban,
    badge:     'BETA',
    moduleKey: MODULE_KEYS.CRM,
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
    // Pai sem restrição: visibilidade determinada pelos subitens visíveis
    title: 'Configurações',
    url:   '/reativacao',
    icon:  Settings,
    items: [
      { title: 'Reativação',        url: '/reativacao',              moduleKey: MODULE_KEYS.REATIVACAO },
      { title: 'Tags',              url: '/configuracoes/tags',       moduleKey: MODULE_KEYS.CONFIGURACOES },
      { title: 'Controle da IA',    url: '/configuracoes/controle-ia', moduleKey: MODULE_KEYS.CONFIGURACOES },
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
