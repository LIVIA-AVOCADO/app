'use client';

import { useSidebarAutoCollapse } from '@/lib/hooks';

/**
 * Wrapper Client Component para aplicar auto-collapse do sidebar
 *
 * Princípios SOLID:
 * - Single Responsibility: Apenas aplica lógica de auto-collapse
 * - Dependency Inversion: Usa hook abstrato useSidebarAutoCollapse
 *
 * Este componente permite que o layout (Server Component) use
 * o hook de auto-collapse sem precisar ser 'use client'
 */
export function SidebarAutoCollapseWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auto-collapse sidebar quando estiver na rota /livechat
  useSidebarAutoCollapse(['/inbox']);

  return children;
}
