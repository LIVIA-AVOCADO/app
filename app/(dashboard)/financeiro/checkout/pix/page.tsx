'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2, Copy, QrCode, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type PixStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';

const POLL_INTERVAL_MS = 5000;

export default function CheckoutPixPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const paymentId = searchParams.get('payment_id');
  const qrCode = searchParams.get('qr_code');
  const qrBase64 = searchParams.get('qr_base64');
  const expiresAt = searchParams.get('expires_at');
  const credits = searchParams.get('credits');

  const [status, setStatus] = useState<PixStatus>('pending');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) {
        setStatus('expired');
        clearInterval(timerRef.current!);
      }
    };

    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current!);
  }, [expiresAt]);

  // Polling de status
  useEffect(() => {
    if (!paymentId || status !== 'pending') return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/mercadopago/pix/status?payment_id=${paymentId}`);
        if (!res.ok) return;

        const data = await res.json();
        const newStatus: PixStatus = data.status;

        if (newStatus !== 'pending') {
          setStatus(newStatus);
          clearInterval(pollRef.current!);

          if (newStatus === 'approved') {
            queryClient.invalidateQueries({ queryKey: ['stripe-billing'] });
            router.push('/financeiro/checkout/sucesso?pix=1');
          }
        }
      } catch {
        // Silencia erros de rede — continua tentando
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current!);
  }, [paymentId, status, queryClient, router]);

  function handleCopy() {
    if (!qrCode) return;
    navigator.clipboard.writeText(qrCode);
    toast.success('Código copiado!');
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  if (!paymentId || !qrCode) {
    return (
      <div className="h-full w-full overflow-y-auto p-6 md:p-8">
        <div className="container max-w-lg mx-auto flex items-center justify-center min-h-[60vh]">
          <Card className="w-full text-center">
            <CardContent className="pt-8 pb-8">
              <p className="text-destructive">Dados do PIX não encontrados.</p>
              <Button asChild className="mt-4">
                <Link href="/financeiro/recarregar">Voltar</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // PIX expirado ou cancelado
  if (status === 'expired' || status === 'cancelled' || status === 'rejected') {
    return (
      <div className="h-full w-full overflow-y-auto p-6 md:p-8">
        <div className="container max-w-lg mx-auto flex items-center justify-center min-h-[60vh]">
          <Card className="w-full text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <XCircle className="h-16 w-16 text-destructive" />
              </div>
              <CardTitle className="text-2xl">
                {status === 'expired' ? 'PIX Expirado' : 'Pagamento Cancelado'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {status === 'expired'
                  ? 'O QR code expirou. Gere um novo para continuar.'
                  : 'O pagamento foi cancelado ou recusado.'}
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/financeiro/recarregar">Tentar novamente</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-8">
      <div className="container max-w-lg mx-auto flex items-center justify-center min-h-[60vh]">
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <QrCode className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Pague com PIX</CardTitle>
            {credits && (
              <p className="text-muted-foreground text-sm mt-1">
                {Number(credits).toLocaleString('pt-BR')} créditos serão adicionados após o pagamento
              </p>
            )}
          </CardHeader>

          <CardContent className="space-y-5">
            {/* QR Code */}
            <div className="flex justify-center">
              {qrBase64 ? (
                <Image
                  src={`data:image/png;base64,${qrBase64}`}
                  alt="QR Code PIX"
                  width={220}
                  height={220}
                  className="rounded-lg border"
                  unoptimized
                />
              ) : (
                <div className="w-[220px] h-[220px] border rounded-lg flex items-center justify-center bg-muted">
                  <QrCode className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Copia e cola */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-center">Ou copie o código PIX</p>
              <div className="flex gap-2">
                <div className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs font-mono truncate select-all">
                  {qrCode}
                </div>
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Countdown */}
            {timeLeft > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400 text-center">
                Expira em <span className="font-mono font-bold">{formatTime(timeLeft)}</span>
              </div>
            )}

            {/* Status aguardando */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 animate-pulse text-primary" />
              Aguardando confirmação do pagamento...
            </div>
          </CardContent>

          <CardFooter>
            <Button variant="outline" asChild className="w-full">
              <Link href="/financeiro/recarregar">Cancelar</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
