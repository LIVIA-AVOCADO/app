'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  History,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  ChevronDown,
  QrCode,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SubscriptionStatusCard } from './subscription-status-card';
import { CustomAmountInput } from './custom-amount-input';
import { useStripeBilling } from '@/hooks/use-stripe-billing';
import type { WalletWithComputed, LedgerEntry } from '@/types/billing';
import { formatBRL } from '@/types/billing';
import type { SubscriptionStatus } from '@/types/stripe';

interface CreditPackageItem {
  id: string;
  name: string;
  label: string | null;
  price_brl_cents: number;
  credits: number;
  bonus_credits: number;
  is_highlighted: boolean;
}

interface RechargePageContentProps {
  tenantId: string;
  tenantName: string;
  wallet: WalletWithComputed | null;
  rechargeHistory: LedgerEntry[];
  creditPackages: CreditPackageItem[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function RechargePageContent({
  wallet,
  rechargeHistory,
  creditPackages,
}: RechargePageContentProps) {
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [loadingPix, setLoadingPix] = useState<string | null>(null);
  const [loadingPixSubscription, setLoadingPixSubscription] = useState(false);
  const [loadingSwitchToPix, setLoadingSwitchToPix] = useState(false);
  const [loadingRevertToStripe, setLoadingRevertToStripe] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { data: billingData, isLoading: isBillingLoading } = useStripeBilling();

  const subscription = billingData?.subscription;
  // Só usa o status real após carregamento — evita default 'inactive' piscando botões
  const subscriptionStatus: SubscriptionStatus = isBillingLoading
    ? 'active' // valor neutro durante loading (não exibe botões de assinar nem bloqueia)
    : (subscription?.subscription_status || 'inactive');
  const subscriptionProvider = subscription?.subscription_provider ?? 'stripe';
  const plans = billingData?.plans || [];
  // Só bloqueia após confirmar que os dados carregaram — evita modal piscando
  const isSubscriptionBlocked = !isBillingLoading && (subscriptionStatus === 'canceled' || subscriptionStatus === 'inactive');

  async function handleBuyCredits(packageId: string) {
    setLoadingPackage(packageId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'payment', packageId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao iniciar checkout');
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Falha na conexão. Verifique sua internet e tente novamente.'
      );
      setLoadingPackage(null);
    }
  }

  async function handlePixPayment(packageId: string) {
    setLoadingPix(packageId);
    try {
      const res = await fetch('/api/mercadopago/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar PIX');
      }

      const params = new URLSearchParams({
        payment_id: data.payment_id,
        qr_code: data.qr_code,
        qr_base64: data.qr_code_base64,
        expires_at: data.expires_at,
        credits: String(data.credits),
      });

      window.location.href = `/financeiro/checkout/pix?${params.toString()}`;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Falha ao gerar PIX. Tente novamente.'
      );
      setLoadingPix(null);
    }
  }

  async function handleCustomAmount(amountCents: number) {
    setLoadingPackage('custom');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'custom_payment', customAmountCents: amountCents }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao iniciar checkout');
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Falha na conexão. Verifique sua internet e tente novamente.'
      );
      setLoadingPackage(null);
    }
  }

  async function handlePixSubscription() {
    setLoadingPixSubscription(true);
    try {
      const res = await fetch('/api/mercadopago/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'subscription' }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar PIX');
      }

      const params = new URLSearchParams({
        payment_id: data.payment_id,
        qr_code: data.qr_code,
        qr_base64: data.qr_code_base64,
        expires_at: data.expires_at,
        mode: 'subscription',
      });

      window.location.href = `/financeiro/checkout/pix?${params.toString()}`;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Falha ao gerar PIX. Tente novamente.'
      );
      setLoadingPixSubscription(false);
    }
  }

  async function handleRevertToStripe() {
    setLoadingRevertToStripe(true);
    try {
      const res = await fetch('/api/stripe/revert-to-stripe', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao reverter para cartão');
      toast.success('Cobrança revertida para o cartão com sucesso');
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao reverter para cartão.');
      setLoadingRevertToStripe(false);
    }
  }

  async function handleSwitchToPix() {
    setLoadingSwitchToPix(true);
    try {
      // 1. Cancela renovação Stripe + muda provider para pix_manual
      const switchRes = await fetch('/api/stripe/switch-to-pix', { method: 'POST' });
      const switchData = await switchRes.json();
      if (!switchRes.ok) throw new Error(switchData.error || 'Erro ao migrar para PIX');

      // 2. Gera PIX da próxima mensalidade imediatamente
      await handlePixSubscription();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao migrar para PIX.');
      setLoadingSwitchToPix(false);
    }
  }

  async function handleSubscribe() {
    const firstPlan = plans[0];
    if (!firstPlan) {
      toast.error('Nenhum plano disponível no momento.');
      return;
    }

    setLoadingPackage('subscription');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'subscription',
          priceId: firstPlan.stripe_price_id,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao iniciar assinatura');
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Falha na conexão. Verifique sua internet e tente novamente.'
      );
      setLoadingPackage(null);
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto p-6 md:p-8">
      {/* Modal bloqueante — assinatura vencida/cancelada */}
      <Dialog open={isSubscriptionBlocked}>
        <DialogContent
          className="sm:max-w-lg [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <DialogTitle className="text-xl">
              Assinatura Inativa
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Sua assinatura de manutenção está{' '}
              {subscriptionStatus === 'canceled' ? 'cancelada' : 'inativa'}.
              Para continuar utilizando o sistema, é necessário ativar sua assinatura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm text-muted-foreground">
              <p>A assinatura inclui:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Sistema online 24/7</li>
                <li>Suporte técnico</li>
                <li>Atualizações e melhorias contínuas</li>
              </ul>
            </div>
            <Button
              className="w-full text-base py-6"
              size="lg"
              onClick={handleSubscribe}
              disabled={loadingPackage === 'subscription' || loadingPixSubscription}
            >
              {loadingPackage === 'subscription' ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-5 w-5 mr-2" />
              )}
              Assinar com Cartão — R$ 300,00/mês
            </Button>
            <Button
              className="w-full text-base py-6"
              size="lg"
              variant="outline"
              onClick={handlePixSubscription}
              disabled={loadingPackage === 'subscription' || loadingPixSubscription}
            >
              {loadingPixSubscription ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <QrCode className="h-5 w-5 mr-2" />
              )}
              Assinar com PIX — R$ 300,00/mês
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="container max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/financeiro/saldo">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recarregar Créditos</h1>
          <p className="text-muted-foreground">
            Compre pacotes de créditos ou gerencie sua assinatura
          </p>
        </div>

        <Separator />

        {/* Seção 1: Status da Manutenção */}
        <SubscriptionStatusCard
          status={subscriptionStatus}
          periodEnd={subscription?.subscription_current_period_end || null}
          cancelAtPeriodEnd={subscription?.subscription_cancel_at_period_end || false}
          subscriptionProvider={subscriptionProvider}
          isLoading={isBillingLoading}
          isSwitchingToPix={loadingSwitchToPix}
          isRevertingToStripe={loadingRevertToStripe}
          onSubscribe={handleSubscribe}
          onPixSubscribe={handlePixSubscription}
          onSwitchToPix={handleSwitchToPix}
          onRevertToStripe={handleRevertToStripe}
        />

        {/* Saldo Atual */}
        {wallet && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Saldo Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {formatBRL(wallet.balance_brl)}
                </span>
                <span className="text-muted-foreground">
                  ({wallet.balance_credits.toLocaleString('pt-BR')} créditos)
                </span>
              </div>
              {wallet.status === 'low' && (
                <p className="text-sm text-yellow-600 mt-2">
                  Seu saldo está baixo. Recomendamos fazer uma recarga.
                </p>
              )}
              {wallet.status === 'critical' && (
                <p className="text-sm text-red-600 mt-2">
                  Seu saldo está crítico! Faça uma recarga para evitar interrupção dos serviços.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Seção 2: Pacotes de Créditos */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Pacotes de Créditos
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {creditPackages.map((pkg) => (
              <Card
                key={pkg.id}
                className={`flex flex-col relative ${pkg.is_highlighted ? 'border-primary shadow-md' : ''}`}
              >
                {pkg.is_highlighted && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    Mais Popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">
                    {pkg.label || `R$ ${(pkg.price_brl_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
                  </CardTitle>
                  <CardDescription>
                    {pkg.credits.toLocaleString('pt-BR')} créditos
                    {pkg.bonus_credits > 0 && (
                      <span className="text-green-600 ml-1">
                        +{pkg.bonus_credits.toLocaleString('pt-BR')} bônus
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Necessários para o Agente IA funcionar. Os créditos não expiram.
                  </p>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button
                    className="w-full"
                    variant={pkg.is_highlighted ? 'default' : 'outline'}
                    onClick={() => handleBuyCredits(pkg.id)}
                    disabled={loadingPackage !== null || loadingPix !== null}
                  >
                    {loadingPackage === pkg.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Cartão
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handlePixPayment(pkg.id)}
                    disabled={loadingPackage !== null || loadingPix !== null}
                  >
                    {loadingPix === pkg.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4 mr-2" />
                    )}
                    PIX
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        {/* Seção 3: Valor Personalizado */}
        <CustomAmountInput
          onSubmit={handleCustomAmount}
          onPixSubmit={async (amountCents) => {
            setLoadingPix('custom');
            try {
              const res = await fetch('/api/mercadopago/pix/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customAmountCents: amountCents }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Erro ao gerar PIX');
              const params = new URLSearchParams({
                payment_id: data.payment_id,
                qr_code: data.qr_code,
                qr_base64: data.qr_code_base64,
                expires_at: data.expires_at,
                credits: String(data.credits),
              });
              window.location.href = `/financeiro/checkout/pix?${params.toString()}`;
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Falha ao gerar PIX.');
              setLoadingPix(null);
            }
          }}
          isLoading={loadingPackage === 'custom'}
          isPixLoading={loadingPix === 'custom'}
        />

        {/* Seção 4: Histórico de Recargas (collapsible) */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Histórico de Recargas
                    </CardTitle>
                    <CardDescription>
                      {rechargeHistory.length > 0
                        ? `${rechargeHistory.length} recarga${rechargeHistory.length > 1 ? 's' : ''} realizada${rechargeHistory.length > 1 ? 's' : ''}`
                        : 'Nenhuma recarga realizada ainda'}
                    </CardDescription>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      historyOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {rechargeHistory.length > 0 ? (
                  <div className="space-y-3">
                    {rechargeHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium">
                              {formatBRL(entry.amount_credits / 100)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.description || 'Recarga de créditos'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {formatDate(entry.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma recarga realizada ainda</p>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
