'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AgentOnlineStatus } from '@/lib/validations/agent-schedule-validation';

interface ScheduleStatusBadgeProps {
  status: AgentOnlineStatus;
  /** Se true, exibe o badge em formato grande (topo da página) */
  large?: boolean;
}

const REASON_LABELS: Record<string, string> = {
  '24_7':                    'Sem horário configurado — online 24/7',
  'weekly_schedule':         'Dentro do horário configurado',
  'exception_custom':        'Horário especial para hoje',
  'outside_schedule':        'Fora do horário configurado',
  'exception_blocked':       'Dia bloqueado',
  'exception_custom_outside':'Fora do horário especial de hoje',
  'error_fallback':          'Erro ao consultar horário',
};

export function ScheduleStatusBadge({ status, large = false }: ScheduleStatusBadgeProps) {
  const label      = status.online ? 'Online agora' : 'Offline agora';
  const reasonText = REASON_LABELS[status.reason] ?? status.reason;

  if (large) {
    return (
      <div className="flex items-center gap-4 rounded-lg border p-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            status.online
              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {status.online ? (
            <Wifi className="h-6 w-6" />
          ) : (
            <WifiOff className="h-6 w-6" />
          )}
        </div>
        <div>
          <p className={`text-lg font-semibold ${status.online ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
            {label}
          </p>
          <p className="text-sm text-muted-foreground">{reasonText}</p>
          {!status.online && status.offline_message && (
            <p className="mt-1 text-xs text-muted-foreground italic">
              Mensagem configurada: &ldquo;{status.offline_message}&rdquo;
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Badge
      variant={status.online ? 'default' : 'secondary'}
      className={status.online ? 'bg-green-600 hover:bg-green-600' : ''}
    >
      {status.online ? (
        <Wifi className="mr-1 h-3 w-3" />
      ) : (
        <WifiOff className="mr-1 h-3 w-3" />
      )}
      {label}
    </Badge>
  );
}
