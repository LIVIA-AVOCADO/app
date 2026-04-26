'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CheckCircle2, XCircle, RefreshCw, AlertCircle, AlertTriangle,
  MessageSquare, Send, Wifi, ChevronDown, ChevronRight,
  Download, ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ChannelLogEntry {
  id:         string;
  tenant_id:  string;
  channel_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  source:     string;
  created_at: string;
  channel?:   { id: string; name: string } | null;
}

export interface SimpleChannel {
  id:   string;
  name: string;
}

interface LogsResponse {
  logs:       ChannelLogEntry[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}

interface Props {
  tenantId:            string;
  initialLogs:         ChannelLogEntry[];
  initialTotal:        number;
  initialTotalPages:   number;
  channels:            SimpleChannel[];
  disconnectedCount:   number;
}

// ─── Config de eventos ───────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, {
  label:     string;
  icon:      React.ElementType;
  iconClass: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  connected:          { label: 'Conectado',          icon: CheckCircle2,   iconClass: 'text-emerald-500', badgeVariant: 'default' },
  disconnected:       { label: 'Desconectado',        icon: XCircle,        iconClass: 'text-red-500',     badgeVariant: 'destructive' },
  qr_generated:       { label: 'QR Gerado',           icon: RefreshCw,      iconClass: 'text-amber-500',   badgeVariant: 'secondary' },
  qr_expired:         { label: 'QR Expirado',         icon: AlertCircle,    iconClass: 'text-orange-500',  badgeVariant: 'secondary' },
  message_received:   { label: 'Msg Recebida',        icon: MessageSquare,  iconClass: 'text-blue-500',    badgeVariant: 'outline' },
  message_sent:       { label: 'Msg Enviada',         icon: Send,           iconClass: 'text-emerald-500', badgeVariant: 'outline' },
  message_failed:     { label: 'Msg Falhou',          icon: AlertTriangle,  iconClass: 'text-red-500',     badgeVariant: 'destructive' },
  webhook_received:   { label: 'Webhook Recebido',    icon: Wifi,           iconClass: 'text-zinc-400',    badgeVariant: 'outline' },
  webhook_error:      { label: 'Erro de Webhook',     icon: AlertTriangle,  iconClass: 'text-orange-500',  badgeVariant: 'destructive' },
  reconnect_attempt:  { label: 'Tentativa Reconexão', icon: RefreshCw,      iconClass: 'text-amber-500',   badgeVariant: 'secondary' },
};

const ALL_EVENT_TYPES = Object.keys(EVENT_CONFIG);

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function ChannelLogs({
  tenantId,
  initialLogs,
  initialTotal,
  initialTotalPages,
  channels,
  disconnectedCount,
}: Props) {
  const [logs, setLogs]               = useState<ChannelLogEntry[]>(initialLogs);
  const [total, setTotal]             = useState(initialTotal);
  const [totalPages, setTotalPages]   = useState(initialTotalPages);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [eventFilter, setEventFilter]     = useState<string>('all');
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const realtimeRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  // ── Fetch paginado ─────────────────────────────────────────���────────────

  const fetchLogs = useCallback(async (p: number, chId: string, evType: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (chId !== 'all')   params.set('channel_id',  chId);
    if (evType !== 'all') params.set('event_type',  evType);

    const res  = await fetch(`/api/channels/logs?${params}`);
    const data: LogsResponse = await res.json();
    setLogs(data.logs);
    setTotal(data.total);
    setTotalPages(data.totalPages);
    setLoading(false);
  }, []);

  // Refetch ao mudar filtros
  useEffect(() => {
    setPage(1);
    fetchLogs(1, channelFilter, eventFilter);
  }, [channelFilter, eventFilter, fetchLogs]);

  // Refetch ao mudar página
  useEffect(() => {
    if (page === 1) return; // inicial já buscado pelo filtro
    fetchLogs(page, channelFilter, eventFilter);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime ────────────────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();

    realtimeRef.current = supabase
      .channel(`channel-logs-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'channel_connection_logs',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const newLog = payload.new as ChannelLogEntry;
          // Aplica filtros locais antes de inserir
          const matchChannel = channelFilter === 'all' || newLog.channel_id === channelFilter;
          const matchEvent   = eventFilter   === 'all' || newLog.event_type  === eventFilter;
          if (matchChannel && matchEvent && page === 1) {
            setLogs((prev) => [newLog, ...prev].slice(0, 50));
            setTotal((prev) => prev + 1);
          }
        },
      )
      .subscribe();

    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, [tenantId, channelFilter, eventFilter, page]);

  // ── CSV Export ──────────────────────────────────────────────────────────

  const exportCSV = async () => {
    // Busca todos os registros do filtro atual (sem paginação)
    const params = new URLSearchParams({ page: '1', limit: '9999' });
    if (channelFilter !== 'all') params.set('channel_id', channelFilter);
    if (eventFilter   !== 'all') params.set('event_type', eventFilter);

    const res  = await fetch(`/api/channels/logs?${params}`);
    const data: LogsResponse = await res.json();

    const header = ['Data/Hora', 'Canal', 'Evento', 'Detalhe', 'Origem'];
    const rows   = data.logs.map((l) => [
      formatTime(l.created_at),
      l.channel?.name ?? l.channel_id ?? '',
      EVENT_CONFIG[l.event_type]?.label ?? l.event_type,
      JSON.stringify(l.event_data),
      l.source,
    ]);

    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `logs-canais-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Logs de Conexão
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Histórico de eventos dos canais em tempo real.
          </p>
        </div>

        {disconnectedCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm font-medium">
            <XCircle className="h-4 w-4 shrink-0" />
            {disconnectedCount} canal{disconnectedCount > 1 ? 'is' : ''} desconectado{disconnectedCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Filtros + Export */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os canais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            {channels.map((ch) => (
              <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos os eventos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            {ALL_EVENT_TYPES.map((et) => (
              <SelectItem key={et} value={et}>
                {EVENT_CONFIG[et]?.label ?? et}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400 w-44">Horário</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400 w-40">Canal</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400 w-44">Evento</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Detalhe / Origem</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-zinc-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-zinc-400">
                  Nenhum log encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
            {!loading && logs.map((log) => {
              const cfg        = EVENT_CONFIG[log.event_type];
              const Icon       = cfg?.icon ?? Wifi;
              const isExpanded = expandedId === log.id;
              const hasData    = Object.keys(log.event_data ?? {}).length > 0;

              return (
                <>
                  <tr
                    key={log.id}
                    onClick={() => hasData && setExpandedId(isExpanded ? null : log.id)}
                    className={cn(
                      'border-b border-zinc-100 dark:border-zinc-800 last:border-0 transition-colors',
                      hasData ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50' : '',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500 whitespace-nowrap">
                      {formatTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 truncate max-w-[160px]">
                      {log.channel?.name ?? <span className="text-zinc-400 italic">–</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <Icon className={cn('h-4 w-4 shrink-0', cfg?.iconClass ?? 'text-zinc-400')} />
                        <Badge variant={cfg?.badgeVariant ?? 'outline'} className="text-xs font-normal">
                          {cfg?.label ?? log.event_type}
                        </Badge>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-zinc-500 text-xs">
                        <span className="shrink-0 capitalize">{log.source}</span>
                        {hasData && (
                          <span className="ml-auto">
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />}
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && hasData && (
                    <tr key={`${log.id}-expanded`} className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                      <td colSpan={4} className="px-4 pb-3 pt-0">
                        <pre className="text-xs font-mono bg-zinc-900 dark:bg-zinc-950 text-emerald-400 p-3 rounded-md overflow-auto max-h-48">
                          {JSON.stringify(log.event_data, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>{total} registro{total !== 1 ? 's' : ''} no total</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || loading}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="tabular-nums">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || loading}
              className="gap-1"
            >
              Próxima
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
