'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCodeDisplay } from './qr-code-display';

interface ReconnectDialogProps {
  open:         boolean;
  instanceName: string;
  onConnected:  (phoneNumber?: string) => void;
  onClose:      () => void;
}

type ConnectState = 'loading_qr' | 'qr_ready' | 'connected' | 'error';

export function ReconnectDialog({
  open,
  instanceName,
  onConnected,
  onClose,
}: ReconnectDialogProps) {
  const [state,       setState]       = useState<ConnectState>('loading_qr');
  const [qrBase64,    setQrBase64]    = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);

  const pollingRef   = useRef<NodeJS.Timeout | null>(null);
  const qrRefreshRef = useRef<NodeJS.Timeout | null>(null);

  function clearTimers() {
    if (pollingRef.current)   clearInterval(pollingRef.current);
    if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
  }

  const fetchQr = useCallback(async () => {
    const res  = await fetch(`/api/configuracoes/conexoes/qrcode/${instanceName}`);
    const data = await res.json() as { base64?: string; pairingCode?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? 'Erro ao obter QR code');
    setQrBase64(data.base64 ?? null);
    setPairingCode(data.pairingCode ?? null);
  }, [instanceName]);

  const startPolling = useCallback(() => {
    clearTimers();

    pollingRef.current = setInterval(async () => {
      try {
        const res  = await fetch('/api/configuracoes/conexoes/status');
        const data = await res.json() as { connectionStatus?: string; phoneNumber?: string };
        if (data.connectionStatus === 'connected') {
          clearTimers();
          setState('connected');
          onConnected(data.phoneNumber);
        }
      } catch { /* silencioso */ }
    }, 3000);

    qrRefreshRef.current = setInterval(async () => {
      try { await fetchQr(); } catch { /* silencioso */ }
    }, 18000);
  }, [fetchQr, onConnected]);

  const initReconnect = useCallback(async () => {
    setState('loading_qr');
    setErrorMsg(null);
    clearTimers();

    try {
      const res  = await fetch('/api/configuracoes/conexoes/reconnect', { method: 'POST' });
      const data = await res.json() as { base64?: string; pairingCode?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erro ao iniciar reconexão');

      setQrBase64(data.base64 ?? null);
      setPairingCode(data.pairingCode ?? null);
      setState('qr_ready');
      startPolling();
    } catch (err) {
      setErrorMsg(String(err));
      setState('error');
    }
  }, [startPolling]);

  useEffect(() => {
    if (open) initReconnect();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    clearTimers();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
          <DialogDescription>
            Escaneie o QR code com o WhatsApp do celular para vincular o número.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-4">
          {state === 'loading_qr' && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-500">Preparando QR code...</p>
            </>
          )}

          {state === 'error' && (
            <>
              <p className="text-sm text-red-500 text-center">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={initReconnect}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </>
          )}

          {state === 'connected' && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">WhatsApp conectado!</p>
              <Button onClick={handleClose}>Fechar</Button>
            </>
          )}

          {state === 'qr_ready' && (
            <QrCodeDisplay base64={qrBase64} pairingCode={pairingCode} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
