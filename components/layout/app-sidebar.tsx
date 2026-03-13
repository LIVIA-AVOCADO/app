'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { navItems } from './nav-items';
import { cn } from '@/lib/utils';
import { SidebarFooter } from '@/components/ui/sidebar';
import { SidebarUserProfile } from './sidebar-user-profile';
import { APP_VERSION } from '@/config/constants';

/**
 * Componente principal do Sidebar do LIVIA
 *
 * Princípios SOLID:
 * - Single Responsibility: Renderiza sidebar completo (toggle + navegação + perfil)
 * - Open/Closed: Extensível via navItems, fechado para modificação
 * - Dependency Inversion: Depende da abstração Sidebar (shadcn)
 *
 * Features:
 * - Toggle integrado no header (sempre acessível, expandido ou colapsado)
 * - Auto-collapse no livechat (gerenciado pelo hook no layout)
 * - Modo icon quando collapsed
 * - Link ativo destacado
 * - Footer com perfil do usuário clicável
 * - Layout responsivo (toggle + logo alinhados quando expandido, empilhados quando colapsado)
 * - Acessibilidade completa
 */

interface AppSidebarProps {
  userName?: string;
  tenantName?: string;
  avatarUrl?: string;
  hasTenant?: boolean;
}

export function AppSidebar({
  userName = 'Usuário',
  tenantName,
  avatarUrl,
  hasTenant = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const visibleNavItems = hasTenant
    ? navItems.filter((item) => !item.url.startsWith('/onboarding'))
    : navItems;

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        {/* Layout quando EXPANDIDO: Toggle + Logo na mesma linha */}
        <div className="flex h-14 items-center justify-between px-2 gap-2 group-data-[collapsible=icon]:hidden">
          <SidebarTrigger />
          <Link
            href="/livechat"
            className="flex-1 flex items-center justify-center font-bold text-sidebar-foreground"
          >
            <Image
              src="/logo.png"
              alt="LIVIA"
              width={100}
              height={28}
              className="object-contain"
              priority
            />
          </Link>
          <div className="w-8" /> {/* Spacer para balancear visualmente */}
        </div>

        {/* Layout quando COLAPSADO: Logo no topo, Toggle embaixo */}
        <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center py-3 gap-3">
          <Link
            href="/livechat"
            className="flex items-center font-bold text-sidebar-foreground"
          >
            <Image
              src="/icon.png"
              alt="LIVIA"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
          </Link>
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden text-[10px] font-semibold tracking-widest uppercase text-white/40 px-2">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map((item) => {
                // Check if current path matches this item or any of its subitems
                const baseUrl = item.url.split('?')[0] ?? item.url;
                const isActive = item.items
                  ? item.items.some(sub => {
                      const subBaseUrl = sub.url.split('?')[0] ?? sub.url;
                      return pathname.startsWith(subBaseUrl);
                    })
                  : pathname.startsWith(baseUrl);

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        isActive &&
                          '!bg-sidebar-primary !text-sidebar-primary-foreground shadow-sm hover:!bg-sidebar-primary/90'
                      )}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex items-center gap-2 flex-1">
                          {item.title}
                          {item.badge === 'BETA' && (
                            <span className="text-[10px] font-normal opacity-60">
                              BETA
                            </span>
                          )}
                        </span>
                      </Link>
                    </SidebarMenuButton>

                    {/* Render Submenu if active and has items */}
                    {item.items && isActive && (
                      <SidebarMenuSub>
                        {item.items.map((subItem) => {
                          // Simple check for query param match if present
                          const subQuery = subItem.url.split('?')[1];
                          const subCategory = new URLSearchParams(subQuery || '').get('category');
                          const currentCategory = searchParams.get('category');

                          // Check if it's a path-based submenu (like /relatorios/principal)
                          // or query-based submenu (like /meus-agentes?category=main)
                          const isSubActive = subCategory
                            ? (currentCategory === subCategory || (!currentCategory && subCategory === 'main'))
                            : pathname === subItem.url;

                          return (
                            <SidebarMenuSubItem key={subItem.url}>
                              <SidebarMenuSubButton asChild isActive={isSubActive}>
                                <Link href={subItem.url}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarUserProfile
          userName={userName}
          tenantName={tenantName}
          avatarUrl={avatarUrl}
        />
        <div className="px-3 pb-1 group-data-[collapsible=icon]:hidden">
          <span className="text-[10px] text-muted-foreground/50 select-none">
            v{APP_VERSION}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
