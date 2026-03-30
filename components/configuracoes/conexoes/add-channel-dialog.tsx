'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCodeDisplay } from './qr-code-display';

interface AddChannelDialogProps {
  open:    boolean;
  onClose: () => void;
}

type Step = 'form' | 'loading' | 'qr_ready' | 'connected' | 'error';

export function AddChannelDialog({ open, onClose }: AddChannelDialogProps) {
  const router = useRouter();

  const [step,        setStep]        = useState<Step>('form');
  const [channelName, setChannelName] = useState('');
  const [channelId,   setChannelId]   = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [qrBase64,    setQrBase64]    = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  const pollingRef   = useRef<NodeJS.Timeout | null>(null);
  const qrRefreshRef = useRef<NodeJS.Timeout | null>(null);

  function clearTimers() {
    if (pollingRef.current)   clearInterval(pollingRef.current);
    if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
  }

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setStep('form');
      setChannelName('');
      setChannelId(null);
      setInstanceName(null);
      setQrBase64(null);
      setPairingCode(null);
      setErrorMsg(null);
    }
    return () => clearTimers();
  }, [open]);

  const fetchQr = useCallback(async (instance: string) => {
    const res  = await fetch(`/api/configuracoes/conexoes/qrcode/${instance}`);
    const data = await res.json() as { base64?: string; pairingCode?: string };
    if (res.ok) {
      setQrBase64(data.base64 ?? null);
      setPairingCode(data.pairingCode ?? null);
    }
  }, []);

  const startPolling = useCallback((chId: string) => {
    clearTimers();

    pollingRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/configuracoes/conexoes/status?channelId=${chId}`);
        const data = await res.json() as { connectionStatus?: string };
        if (data.connectionStatus === 'connected') {
          clearTimers();
          setStep('connected');
        }
      } catch { /* silencioso */ }
    }, 3000);

    qrRefreshRef.current = setInterval(async () => {
      if (instanceName) {
        try { await fetchQr(instanceName); } catch { /* silencioso */ }
      }
    }, 18000);
  }, [instanceName, fetchQr]);

  async function handleCreate() {
    if (!channelName.trim()) return;
    setSubmitting(true);
    setStep('loading');
    setErrorMsg(null);

    try {
      const res  = await fetch('/api/configuracoes/conexoes/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: channelName.trim() }),
      });
      const data = await res.json() as {
        channelId?: string; instanceName?: string;
        base64?: string; pairingCode?: string;
        error?: string; warning?: string;
      };

      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar canal');

      setChannelId(data.channelId!);
      setInstanceName(data.instanceName!);
      setQrBase64(data.base64 ?? null);
      setPairingCode(data.pairingCode ?? null);
      setStep('qr_ready');
      startPolling(data.channelId!);
    } catch (err) {
      setErrorMsg(String(err));
      setStep('error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleConnectedClose() {
    clearTimers();
    onClose();
    router.refresh();
  }

  function handleClose() {
    clearTimers();
    // Se canal foi criado mas ainda não conectado, fecha e faz refresh para mostrar o card
    if (channelId && step !== 'connected') router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar canal WhatsApp</DialogTitle>
          <DialogDescription>
            {step === 'form'     && 'Defina um nome para identificar este canal.'}
            {step === 'loading'  && 'Criando instância...'}
            {step === 'qr_ready' && 'Escaneie o QR code para vincular o número.'}
            {step === 'connected' && 'Número conectado com sucesso!'}
            {step === 'error'    && 'Ocorreu um erro.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {/* ── Step: form ── */}
          {step === 'form' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="channel-name">Nome do canal</Label>
                <Input
                  id="channel-name"
                  placeholder="Ex: WhatsApp Vendas"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={!channelName.trim() || submitting}>
                  Criar canal
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: loading ── */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-500">Preparando instância e QR code...</p>
            </div>
          )}

          {/* ── Step: error ── */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <p className="text-sm text-red-500">{errorMsg}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Fechar</Button>
                <Button variant="outline" onClick={() => setStep('form')}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: qr_ready ── */}
          {step === 'qr_ready' && (
            <div className="flex flex-col items-center gap-4">
              <QrCodeDisplay base64={qrBase64} pairingCode={pairingCode} />
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Fechar e continuar depois
              </Button>
            </div>
          )}

          {/* ── Step: connected ── */}
          {step === 'connected' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">Canal conectado!</p>
              <Button onClick={handleConnectedClose}>Concluir</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
