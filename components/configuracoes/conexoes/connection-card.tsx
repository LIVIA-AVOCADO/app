'use client';

import { useState } from 'react';
import { RefreshCw, Power, RotateCcw, Wifi, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConnectionStatusBadge } from './connection-status-badge';
import { DisconnectConfirmDialog } from './disconnect-confirm-dialog';
import { ReconnectDialog } from './reconnect-dialog';
import { DeleteInstanceDialog } from './delete-instance-dialog';
import { useChannelRealtime } from '@/lib/hooks/use-channel-realtime';
import { useRouter } from 'next/navigation';

export interface ChannelData {
  id:               string;
  name:             string;
  instanceName:     string;
  connectionStatus: string;
  phoneNumber:      string;
  profileName:      string | null;
  profilePictureUrl: string | null;
}

interface ConnectionCardProps {
  channel:    ChannelData;
  canAct:     boolean;  // false = view-only (módulo conexoes-view)
}

export function ConnectionCard({ channel, canAct }: ConnectionCardProps) {
  const router = useRouter();
  const { status, setStatus } = useChannelRealtime(channel.id, {
    connectionStatus: channel.connectionStatus,
    phoneNumber:      channel.phoneNumber,
  });

  const [refreshing,        setRefreshing]       = useState(false);
  const [restarting,        setRestarting]       = useState(false);
  const [disconnecting,     setDisconnecting]    = useState(false);
  const [showDisconnectDlg, setShowDisconnectDlg] = useState(false);
  const [showReconnectDlg,  setShowReconnectDlg]  = useState(false);
  const [showDeleteDlg,     setShowDeleteDlg]     = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res  = await fetch('/api/configuracoes/conexoes/status');
      const data = await res.json() as { connectionStatus?: string; phoneNumber?: string; profileName?: string; error?: string };
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

  async function handleRestart() {
    setRestarting(true);
    try {
      const res  = await fetch('/api/configuracoes/conexoes/restart', { method: 'POST' });
      const data = await res.json() as { connectionStatus?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erro');
      setStatus((prev) => ({ ...prev, connectionStatus: 'connecting' }));
      toast.success('Instância reiniciada. Aguardando reconexão...');
    } catch {
      toast.error('Erro ao reiniciar instância');
    } finally {
      setRestarting(false);
    }
  }

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

  const isConnected    = status.connectionStatus === 'connected';
  const isDisconnected = status.connectionStatus === 'disconnected';
  const isBusy         = refreshing || restarting || disconnecting;

  function handleDeleted() {
    setShowDeleteDlg(false);
    toast.success(`Canal "${channel.name}" deletado`);
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wifi className="h-4 w-4 text-zinc-400" />
            {channel.name}
          </CardTitle>
          <ConnectionStatusBadge status={status.connectionStatus} />
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

          <p className="text-xs text-zinc-400">
            Instância: <span className="font-mono">{channel.instanceName}</span>
          </p>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={handleRefresh}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar Status
            </Button>

            {canAct && isConnected && (
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

            {canAct && isConnected && (
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

            {canAct && isDisconnected && (
              <Button
                size="sm"
                disabled={isBusy}
                onClick={() => setShowReconnectDlg(true)}
              >
                Conectar número
              </Button>
            )}

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

      <DeleteInstanceDialog
        open={showDeleteDlg}
        channelId={channel.id}
        channelName={channel.name}
        onDeleted={handleDeleted}
        onCancel={() => setShowDeleteDlg(false)}
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
  return `+${digits}`;
}
