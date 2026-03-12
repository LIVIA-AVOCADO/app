import { MessageSquare, BookOpen, Kanban, Bot, BarChart3, Wallet, Settings, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Tipo para items de navegação do sidebar
 *
 * Princípio: Interface Segregation (SOLID)
 * Apenas os campos necessários para renderizar um item
 */
export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: string | number;
  items?: {
    title: string;
    url: string;
  }[];
}

/**
 * Configuração dos items de navegação do LIVIA
 *
 * Princípio: Single Responsibility (SOLID)
 * Arquivo dedicado apenas à configuração de navegação
 */
export const navItems: NavItem[] = [
  {
    title: 'Onboarding',
    url:   '/onboarding',
    icon:  Rocket,
    badge: 'NEW',
  },
  {
    title: 'Livechat',
    url: '/livechat',
    icon: MessageSquare,
  },
  {
    title: 'CRM',
    url: '/crm',
    icon: Kanban,
    badge: 'BETA',
  },
  {
    title: 'Base de Conhecimento',
    url: '/knowledge-base',
    icon: BookOpen,
    items: [
      {
        title: 'Gerenciar Bases',
        url: '/knowledge-base',
      },
      {
        title: 'Validar Respostas',
        url: '/neurocore',
      },
    ],
  },
  {
    title: 'Meus Agentes IA',
    url: '/meus-agentes',
    icon: Bot,
  },
  {
    title: 'Configurações',
    url: '/reativacao',
    icon: Settings,
    items: [
      {
        title: 'Reativação',
        url: '/reativacao',
      },
      {
        title: 'Tags',
        url: '/configuracoes/tags',
      },
      {
        title: 'Controle da IA',
        url: '/configuracoes/controle-ia',
      },
      {
        title: 'Gerenciar Usuários',
        url: '/gerenciar-usuarios',
      },
    ],
  },
  {
    title: 'Relatórios',
    url: '/relatorios/principal',
    icon: BarChart3,
    items: [
      {
        title: 'Principal',
        url: '/relatorios/principal',
      },
      {
        title: 'Conversas',
        url: '/relatorios/conversas',
      },
      {
        title: 'Tags',
        url: '/relatorios/tags',
      },
    ],
  },
  {
    title: 'Financeiro',
    url: '/financeiro/saldo',
    icon: Wallet,
    items: [
      {
        title: 'Saldo & Créditos',
        url: '/financeiro/saldo',
      },
      {
        title: 'Consumo',
        url: '/financeiro/consumo',
      },
      {
        title: 'Extrato',
        url: '/financeiro/extrato',
      },
      {
        title: 'Recarregar',
        url: '/financeiro/recarregar',
      },
    ],
  },
];
