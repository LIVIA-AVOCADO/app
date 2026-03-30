import { Loader2, Smartphone } from 'lucide-react';

interface QrCodeDisplayProps {
  base64:      string | null;
  pairingCode: string | null;
}

export function QrCodeDisplay({ base64, pairingCode }: QrCodeDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Smartphone className="h-4 w-4" />
        <span>WhatsApp → Dispositivos conectados → Conectar</span>
      </div>

      {base64 && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white p-4 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={base64}
            alt="QR Code WhatsApp"
            width={200}
            height={200}
            className="rounded-lg"
          />
        </div>
      )}

      {pairingCode && (
        <div className="text-center">
          <p className="text-xs text-zinc-400 mb-1">Código de pareamento:</p>
          <p className="font-mono text-xl font-bold tracking-[0.25em] text-zinc-800 dark:text-zinc-200">
            {pairingCode}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Aguardando conexão...
      </div>
    </div>
  );
}
