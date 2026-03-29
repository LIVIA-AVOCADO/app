'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsappConnectProps {
  sessionId: string;
}

type ConnectState = 'creating' | 'qr_ready' | 'connected' | 'error';

export function WhatsappConnect({ sessionId }: WhatsappConnectProps) {
  const router = useRouter();
  const [state,        setState]        = useState<ConnectState>('creating');
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [qrBase64,     setQrBase64]     = useState<string | null>(null);
  const [pairingCode,  setPairingCode]  = useState<string | null>(null);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

  const pollingRef   = useRef<NodeJS.Timeout | null>(null);
  const qrRefreshRef = useRef<NodeJS.Timeout | null>(null);

  function clearTimers() {
    if (pollingRef.current)   clearInterval(pollingRef.current);
    if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
  }

  const fetchQrCode = useCallback(async (name: string) => {
    const res  = await fetch(`/api/onboarding/evolution/qrcode/${name}`);
    const data = await res.json() as { base64?: string; pairingCode?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? 'Erro ao obter QR code');
    setQrBase64(data.base64 ?? null);
    setPairingCode(data.pairingCode ?? null);
  }, []);

  const startPolling = useCallback((name: string) => {
    clearTimers();

    // Verifica conexão a cada 3s
    pollingRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/onboarding/evolution/status/${name}?sessionId=${sessionId}`);
        const data = await res.json() as { state?: string };
        if (data.state === 'open') {
          clearTimers();
          setState('connected');
        }
      } catch { /* silencioso */ }
    }, 3000);

    // Renova QR code a cada 18s (expira em ~20s)
    qrRefreshRef.current = setInterval(async () => {
      try {
        await fetchQrCode(name);
      } catch { /* silencioso */ }
    }, 18000);
  }, [sessionId, fetchQrCode]);

  const createInstance = useCallback(async () => {
    setState('creating');
    setErrorMsg(null);
    clearTimers();

    try {
      const res  = await fetch('/api/onboarding/evolution/instance', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId }),
      });
      const data = await res.json() as { instanceName?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar instância');

      const name = data.instanceName!;
      setInstanceName(name);

      await fetchQrCode(name);
      setState('qr_ready');
      startPolling(name);
    } catch (err) {
      setErrorMsg(String(err));
      setState('error');
    }
  }, [sessionId, fetchQrCode, startPolling]);

  useEffect(() => {
    createInstance();
    return () => clearTimers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Estados ──────────────────────────────────────────────────

  if (state === 'creating') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        <p className="text-sm text-zinc-500">Preparando sua instância WhatsApp...</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <p className="text-sm text-red-500">{errorMsg}</p>
        <Button variant="outline" onClick={createInstance}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (state === 'connected') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">WhatsApp conectado!</p>
          <p className="text-sm text-zinc-500">Seu número foi vinculado com sucesso.</p>
        </div>
        <Button onClick={() => router.push(`/onboarding/${sessionId}/review`)}>
          Continuar configuração
        </Button>
      </div>
    );
  }

  // qr_ready
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Smartphone className="h-5 w-5 text-zinc-500" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Conecte seu WhatsApp
          </h2>
        </div>
        <p className="text-sm text-zinc-500 max-w-xs">
          Abra o WhatsApp no celular → <strong>Dispositivos conectados</strong> → Conectar dispositivo → Escaneie o QR code.
        </p>
      </div>

      {qrBase64 && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white p-4 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrBase64}
            alt="QR Code WhatsApp"
            width={220}
            height={220}
            className="rounded-lg"
          />
        </div>
      )}

      {pairingCode && (
        <div className="text-center">
          <p className="text-xs text-zinc-400 mb-1">Ou use o código de pareamento:</p>
          <p className="font-mono text-xl font-bold tracking-[0.25em] text-zinc-800 dark:text-zinc-200">
            {pairingCode}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Aguardando conexão...
      </div>

      <p className="text-[10px] text-zinc-300 dark:text-zinc-600">
        Instância: {instanceName}
      </p>
    </div>
  );
}
