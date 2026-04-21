'use client';

import Image from 'next/image';
import Link from 'next/link';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * Toggle + Logo Dinâmico
 *
 * Princípios SOLID:
 * - Single Responsibility: Gerencia apenas toggle + logo quando sidebar colapsado
 * - Dependency Inversion: Usa useSidebar hook (abstração)
 *
 * Comportamento:
 * - Quando COLAPSADO: Mostra fixo fora do sidebar com [☰] + Logo LIVIA
 * - Quando EXPANDIDO: Esconde completamente (logo fica dentro do sidebar)
 *
 * Features:
 * - position: fixed para ficar sobre o conteúdo
 * - z-index: 50 (acima do conteúdo, abaixo de modals)
 * - Transição suave com opacity/transform
 * - Acessibilidade mantida (SidebarTrigger do shadcn)
 */
export function SidebarToggleHeader() {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <div
      className={cn(
        'fixed top-0 left-0 z-50 flex h-14 items-center gap-3 px-4 bg-background border-b border-border transition-all duration-200',
        // Quando expandido, esconde completamente
        isCollapsed
          ? 'opacity-100 translate-x-0 pointer-events-auto'
          : 'opacity-0 -translate-x-4 pointer-events-none'
      )}
    >
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <Link
        href="/inbox"
        className="flex items-center font-bold text-foreground"
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
    </div>
  );
}
