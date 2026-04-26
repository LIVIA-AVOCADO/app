'use client';

import { Bot, Users, MessageSquare, TrendingUp, CheckCircle2, UserPlus, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CRMMetricsSummary, DailyMetricRow } from '@/lib/queries/crm-metrics';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  note?: string;
}

function StatCard({ label, value, icon: Icon, note }: StatCardProps) {
  return (
    <div className="border rounded-xl p-4 bg-card space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function fmtDuration(seconds: number | null) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

interface HistoryChartProps {
  rows: DailyMetricRow[];
}

function HistoryChart({ rows }: HistoryChartProps) {
  if (rows.length === 0) return null;

  const maxTotal = Math.max(...rows.map((r) => r.total_conversations), 1);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Histórico diário (últimos 30 dias)</h2>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1 min-w-max h-32">
          {rows.map((row) => {
            const pct = (row.total_conversations / maxTotal) * 100;
            const closedPct = row.total_conversations > 0
              ? (row.closed_conversations / row.total_conversations) * 100
              : 0;
            return (
              <div key={row.date} className="flex flex-col items-center gap-1 group">
                <div className="relative w-8 flex flex-col justify-end" style={{ height: '96px' }}>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-popover border rounded-md shadow-md text-xs p-2 whitespace-nowrap">
                    <p className="font-medium">{fmtDate(row.date)}</p>
                    <p>Novas: {row.total_conversations}</p>
                    <p>Encerradas: {row.closed_conversations}</p>
                    {row.ai_handled > 0 && <p>IA: {row.ai_handled}</p>}
                    {row.avg_resolution_s != null && <p>Resolução: {fmtDuration(row.avg_resolution_s)}</p>}
                  </div>
                  {/* Bar */}
                  <div
                    className="w-full rounded-t bg-primary/20 relative overflow-hidden transition-all"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-primary rounded-t transition-all"
                      style={{ height: `${closedPct}%` }}
                    />
                  </div>
                </div>
                <span className="text-[9px] text-muted-foreground">{fmtDate(row.date)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="h-2 w-3 rounded bg-primary/20 inline-block" />
          Novas conversas
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-3 rounded bg-primary inline-block" />
          Encerradas
        </div>
      </div>

      {/* CSAT summary */}
      {rows.some((r) => r.csat_positive > 0 || r.csat_negative > 0) && (
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <ThumbsUp className="h-4 w-4" />
            <span>{rows.reduce((s, r) => s + r.csat_positive, 0)} positivos</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-red-500">
            <ThumbsDown className="h-4 w-4" />
            <span>{rows.reduce((s, r) => s + r.csat_negative, 0)} negativos</span>
          </div>
        </div>
      )}
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
        <p className="text-sm text-muted-foreground mt-1">
          Métricas em tempo real
          {metrics.dailyHistory.length > 0 && ' · histórico via job diário'}
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total de contatos"   value={metrics.totalContacts}       icon={Users} />
        <StatCard label="Novos contatos (30d)" value={metrics.contactsLast30d}     icon={UserPlus}   note="últimos 30 dias" />
        <StatCard label="Conversas ativas"    value={metrics.activeConversations}  icon={MessageSquare} />
        <StatCard label="Encerradas (30d)"    value={metrics.closedLast30d}        icon={CheckCircle2} note="últimos 30 dias" />
        <StatCard label="Com IA ativa"        value={metrics.iaHandled}            icon={Bot}        note="conversas abertas" />
        <StatCard label="Modo manual"         value={metrics.humanHandled}         icon={Users}      note="conversas abertas" />
        <StatCard label="Mensagens (7d)"      value={metrics.messagesLast7d}       icon={MessageSquare} note="últimos 7 dias" />
        <StatCard
          label="Valor em pipeline"
          value={`R$ ${totalDealValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          note={`${totalInPipeline} conversas`}
        />
      </div>

      {/* Historical chart (only when metrics_daily has data) */}
      {metrics.dailyHistory.length > 0 ? (
        <HistoryChart rows={metrics.dailyHistory} />
      ) : (
        <div className="border rounded-xl p-6 bg-card/50 text-center space-y-1">
          <p className="text-sm font-medium">Histórico diário ainda não disponível</p>
          <p className="text-xs text-muted-foreground">
            O job n8n populará esta área após a primeira execução (diariamente às 03:00 UTC).
          </p>
        </div>
      )}

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
                      <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className="font-medium">{stage.name}</span>
                    </div>
                    <div className={cn('flex items-center gap-4', 'text-muted-foreground')}>
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
