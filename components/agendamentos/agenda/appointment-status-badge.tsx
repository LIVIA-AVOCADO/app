'use client';

import { Badge } from '@/components/ui/badge';
import type { AppointmentStatus } from '@/types/scheduling';

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  held:      { label: 'Reservado',   variant: 'secondary' },
  pending:   { label: 'Pendente',    variant: 'outline' },
  confirmed: { label: 'Confirmado',  variant: 'default' },
  canceled:  { label: 'Cancelado',   variant: 'destructive' },
  completed: { label: 'Concluído',   variant: 'secondary' },
  no_show:   { label: 'Não compareceu', variant: 'destructive' },
};

interface AppointmentStatusBadgeProps {
  status: AppointmentStatus;
}

export function AppointmentStatusBadge({ status }: AppointmentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
