'use client';

import { Bot, Users, MessageSquare, TrendingUp, CheckCircle2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CRMMetricsSummary } from '@/lib/queries/crm-metrics';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  className?: string;
  note?: string;
}

function StatCard({ label, value, icon: Icon, className, note }: StatCardProps) {
  return (
    <div className={cn('border rounded-xl p-4 bg-card space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

interface Props {
  metrics: CRMMetricsSummary;
}

export function CRMMetricsView({ metrics }: Props) {
  const totalDealValue = metrics.pipelineByStage.reduce((s, p) => s + p.dealValue, 0);
  const totalInPipeline = metrics.pipelineByStage.reduce((s, p) => s + p.count, 0);

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Relatório CRM</h1>
        <p className="text-sm text-muted-foreground mt-1">Métricas calculadas em tempo real</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total de contatos"
          value={metrics.totalContacts}
          icon={Users}
        />
        <StatCard
          label="Novos contatos (30d)"
          value={metrics.contactsLast30d}
          icon={UserPlus}
          note="últimos 30 dias"
        />
        <StatCard
          label="Conversas ativas"
          value={metrics.activeConversations}
          icon={MessageSquare}
        />
        <StatCard
          label="Encerradas (30d)"
          value={metrics.closedLast30d}
          icon={CheckCircle2}
          note="últimos 30 dias"
        />
        <StatCard
          label="Com IA ativa"
          value={metrics.iaHandled}
          icon={Bot}
          note="conversas abertas"
        />
        <StatCard
          label="Modo manual"
          value={metrics.humanHandled}
          icon={Users}
          note="conversas abertas"
        />
        <StatCard
          label="Mensagens (7d)"
          value={metrics.messagesLast7d}
          icon={MessageSquare}
          note="últimos 7 dias"
        />
        <StatCard
          label="Valor em pipeline"
          value={`R$ ${totalDealValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          note={`${totalInPipeline} conversas`}
        />
      </div>

      {/* Pipeline breakdown */}
      {metrics.pipelineByStage.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Distribuição por estágio</h2>
          <div className="space-y-3">
            {metrics.pipelineByStage.map((stage) => {
              const pct = totalInPipeline > 0 ? (stage.count / totalInPipeline) * 100 : 0;
              return (
                <div key={stage.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="font-medium">{stage.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>{stage.count} conversas</span>
                      {stage.dealValue > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          R$ {stage.dealValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: stage.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
