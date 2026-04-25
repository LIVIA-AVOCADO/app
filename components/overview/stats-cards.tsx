'use client';

import { MessageSquare, CheckCircle2, Clock, Bot } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { OverviewStats } from './types';

interface StatsCardsProps {
  stats: OverviewStats;
  isRefreshing?: boolean;
}

const CARDS = [
  {
    key: 'open_total' as const,
    label: 'Abertas',
    icon: MessageSquare,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    key: 'closed_today' as const,
    label: 'Fechadas hoje',
    icon: CheckCircle2,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
  {
    key: 'unassigned_manual' as const,
    label: 'Fila (não atribuídas)',
    icon: Clock,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  {
    key: 'ia_active' as const,
    label: 'Com IA ativa',
    icon: Bot,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
];

export function StatsCards({ stats, isRefreshing }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {CARDS.map(({ key, label, icon: Icon, color, bg }) => (
        <Card key={key}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              {isRefreshing && (
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
              )}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-semibold tabular-nums">{stats[key]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
