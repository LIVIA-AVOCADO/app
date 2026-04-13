'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Clock, QrCode } from 'lucide-react';
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

type SessionStatus = {
  payment_status: string;
  payment_method_type: string;
  is_pix_pending: boolean;
};

export default function CheckoutSucessoPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    fetch(`/api/stripe/checkout/status?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data: SessionStatus) => {
        setStatus(data);

        if (!data.is_pix_pending) {
          queryClient.invalidateQueries({ queryKey: ['stripe-billing'] });
          toast.success('Pagamento realizado com sucesso!');
        } else {
          toast.info('PIX gerado! Pague pelo seu banco para confirmar os créditos.');
        }
      })
      .catch(() => {
        // Fallback: assume card payment succeeded
        queryClient.invalidateQueries({ queryKey: ['stripe-billing'] });
        toast.success('Pagamento realizado com sucesso!');
      })
      .finally(() => setLoading(false));
  }, [sessionId, queryClient]);

  if (loading) {
    return (
      <div className="h-full w-full overflow-y-auto p-6 md:p-8">
        <div className="container max-w-lg mx-auto flex items-center justify-center min-h-[60vh]">
          <Card className="w-full text-center">
            <CardContent className="pt-8 pb-8">
              <p className="text-muted-foreground">Verificando pagamento...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // PIX pendente
  if (status?.is_pix_pending) {
    return (
      <div className="h-full w-full overflow-y-auto p-6 md:p-8">
        <div className="container max-w-lg mx-auto flex items-center justify-center min-h-[60vh]">
          <Card className="w-full text-center">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <QrCode className="h-16 w-16 text-primary" />
                  <Clock className="h-6 w-6 text-amber-500 absolute -bottom-1 -right-1 bg-background rounded-full" />
                </div>
              </div>
              <CardTitle className="text-2xl">PIX gerado com sucesso!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Seu código PIX foi gerado. Abra o app do seu banco e realize o pagamento para que os créditos sejam adicionados à sua conta.
              </p>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
                O PIX expira em <strong>4 horas</strong>. Os créditos são adicionados automaticamente após a confirmação do pagamento.
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/financeiro/saldo">Ver Saldo</Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/financeiro/recarregar">Voltar para Recargas</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Cartão / PIX já pago
  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-8">
      <div className="container max-w-lg mx-auto flex items-center justify-center min-h-[60vh]">
        <Card className="w-full text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Pagamento Confirmado!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">
              Seu pagamento foi processado com sucesso. Os créditos serão adicionados à sua conta em instantes.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href="/financeiro/saldo">Ver Saldo</Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/financeiro/recarregar">Voltar para Recargas</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
