'use client';

import { useState } from 'react';
import { RefreshCw, Power, RotateCcw, Wifi, Trash2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConnectionStatusBadge } from './connection-status-badge';
import { DisconnectConfirmDialog } from './disconnect-confirm-dialog';
import { ReconnectDialog } from './reconnect-dialog';
import { DeleteInstanceDialog } from './delete-instance-dialog';
import { UpdateMetaCredentialsDialog } from './update-meta-credentials-dialog';
import { useChannelRealtime } from '@/lib/hooks/use-channel-realtime';
import { useRouter } from 'next/navigation';

export interface ChannelData {
  id:                string;
  name:              string;
  instanceName:      string;   // Evolution: instance name | Meta: phone_number_id
  connectionStatus:  string;
  phoneNumber:       string;
  profileName:       string | null;
  profilePictureUrl: string | null;
  providerType:      'evolution' | 'meta' | 'unknown';
}

interface ConnectionCardProps {
  channel: ChannelData;
  canAct:  boolean;  // false = view-only (módulo conexoes-view)
}

export function ConnectionCard({ channel, canAct }: ConnectionCardProps) {
  const router = useRouter();
  const { status, setStatus } = useChannelRealtime(channel.id, {
    connectionStatus: channel.connectionStatus,
    phoneNumber:      channel.phoneNumber,
  });

  const [refreshing,           setRefreshing]           = useState(false);
  const [restarting,           setRestarting]           = useState(false);
  const [disconnecting,        setDisconnecting]        = useState(false);
  const [showDisconnectDlg,    setShowDisconnectDlg]    = useState(false);
  const [showReconnectDlg,     setShowReconnectDlg]     = useState(false);
  const [showDeleteDlg,        setShowDeleteDlg]        = useState(false);
  const [showUpdateMetaDlg,    setShowUpdateMetaDlg]    = useState(false);

  const isMeta      = channel.providerType === 'meta';
  const isEvolution = channel.providerType === 'evolution' || channel.providerType === 'unknown';

  // ── Status refresh ────────────────────────────────────────────────────────

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const url = isMeta
        ? `/api/configuracoes/conexoes/meta/status?channelId=${channel.id}`
        : `/api/configuracoes/conexoes/status?channelId=${channel.id}`;

      const res  = await fetch(url);
      const data = await res.json() as {
        connectionStatus?: string;
        phoneNumber?:      string;
        verifiedName?:     string;
        error?:            string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Erro');
      setStatus({
        connectionStatus: data.connectionStatus ?? status.connectionStatus,
        phoneNumber:      data.phoneNumber      ?? status.phoneNumber,
      });
      toast.success('Status atualizado');
    } catch {
      toast.error('Erro ao atualizar status');
    } finally {
      setRefreshing(false);
    }
  }

  // ── Evolution-only: restart ───────────────────────────────────────────────

  async function handleRestart() {
    setRestarting(true);
    try {
      const res  = await fetch('/api/configuracoes/conexoes/restart', { method: 'POST' });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erro');
      setStatus((prev) => ({ ...prev, connectionStatus: 'connecting' }));
      toast.success('Instância reiniciada. Aguardando reconexão...');
    } catch {
      toast.error('Erro ao reiniciar instância');
    } finally {
      setRestarting(false);
    }
  }

  // ── Evolution-only: disconnect ────────────────────────────────────────────

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res  = await fetch('/api/configuracoes/conexoes/disconnect', { method: 'POST' });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erro');
      setStatus({ connectionStatus: 'disconnected', phoneNumber: '' });
      toast.success('Número desconectado com sucesso');
    } catch {
      toast.error('Erro ao desconectar');
    } finally {
      setDisconnecting(false);
      setShowDisconnectDlg(false);
    }
  }

  function handleConnected(phoneNumber?: string) {
    setStatus({ connectionStatus: 'connected', phoneNumber: phoneNumber ?? '' });
  }

  function handleDeleted() {
    setShowDeleteDlg(false);
    toast.success(`Canal "${channel.name}" deletado`);
    router.refresh();
  }

  function handleMetaCredentialsUpdated(phoneNumber?: string) {
    setStatus({ connectionStatus: 'connected', phoneNumber: phoneNumber ?? status.phoneNumber });
    toast.success('Credenciais atualizadas com sucesso');
  }

  const isConnected    = status.connectionStatus === 'connected';
  const isDisconnected = status.connectionStatus === 'disconnected';
  const isBusy         = refreshing || restarting || disconnecting;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wifi className="h-4 w-4 text-zinc-400" />
            {channel.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isMeta && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">Meta</Badge>
            )}
            <ConnectionStatusBadge status={status.connectionStatus} />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Perfil conectado */}
          <div className="flex items-center gap-3">
            {channel.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.profilePictureUrl}
                alt="Foto do perfil"
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <Wifi className="h-5 w-5 text-zinc-400" />
              </div>
            )}
            <div className="min-w-0">
              {channel.profileName && (
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {channel.profileName}
                </p>
              )}
              <p className="text-sm text-zinc-500 truncate">
                {status.phoneNumber
                  ? formatPhone(status.phoneNumber)
                  : isDisconnected
                    ? 'Nenhum número conectado'
                    : '—'}
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-1">
            {/* Refresh — disponível para todos */}
            <Button
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={handleRefresh}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar Status
            </Button>

            {/* ── Evolution-only actions ── */}
            {isEvolution && canAct && isConnected && (
              <Button
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={handleRestart}
              >
                <RotateCcw className={`h-4 w-4 mr-1.5 ${restarting ? 'animate-spin' : ''}`} />
                {restarting ? 'Reiniciando...' : 'Reiniciar'}
              </Button>
            )}

            {isEvolution && canAct && isConnected && (
              <Button
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => setShowDisconnectDlg(true)}
                className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              >
                <Power className="h-4 w-4 mr-1.5" />
                Desconectar
              </Button>
            )}

            {isEvolution && canAct && isDisconnected && (
              <Button
                size="sm"
                disabled={isBusy}
                onClick={() => setShowReconnectDlg(true)}
              >
                Conectar número
              </Button>
            )}

            {/* ── Meta-only actions ── */}
            {isMeta && canAct && isDisconnected && (
              <Button
                size="sm"
                disabled={isBusy}
                onClick={() => setShowUpdateMetaDlg(true)}
              >
                <KeyRound className="h-4 w-4 mr-1.5" />
                Atualizar token
              </Button>
            )}

            {/* Delete — disponível para todos os tipos */}
            {canAct && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isBusy}
                onClick={() => setShowDeleteDlg(true)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 ml-auto"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Deletar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Evolution dialogs ── */}
      <DisconnectConfirmDialog
        open={showDisconnectDlg}
        phoneNumber={status.phoneNumber}
        loading={disconnecting}
        onConfirm={handleDisconnect}
        onCancel={() => setShowDisconnectDlg(false)}
      />

      <ReconnectDialog
        open={showReconnectDlg}
        instanceName={channel.instanceName}
        onConnected={handleConnected}
        onClose={() => setShowReconnectDlg(false)}
      />

      {/* ── Shared delete dialog — uses meta or evolution route based on provider ── */}
      <DeleteInstanceDialog
        open={showDeleteDlg}
        channelId={channel.id}
        channelName={channel.name}
        providerType={channel.providerType}
        onDeleted={handleDeleted}
        onCancel={() => setShowDeleteDlg(false)}
      />

      {/* ── Meta dialogs ── */}
      <UpdateMetaCredentialsDialog
        open={showUpdateMetaDlg}
        channelId={channel.id}
        phoneNumberId={channel.instanceName}
        onUpdated={handleMetaCredentialsUpdated}
        onClose={() => setShowUpdateMetaDlg(false)}
      />
    </>
  );
}

function formatPhone(raw: string): string {
  // 5511999999999 → +55 11 99999-9999
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return raw.startsWith('+') ? raw : `+${digits}`;
}
