'use client';

import { useState } from 'react';
import { Shield, Loader2, ExternalLink, QrCode, CreditCard } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { SubscriptionStatus } from '@/types/stripe';

interface SubscriptionStatusCardProps {
  status: SubscriptionStatus;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionProvider?: 'stripe' | 'pix_manual';
  hasStripeSubscription?: boolean;
  isLoading?: boolean;
  isSwitchingToPix?: boolean;
  isRevertingToStripe?: boolean;
  onSubscribe?: () => void;
  onPixSubscribe?: () => void;
  onSwitchToPix?: () => void;
  onRevertToStripe?: () => void;
}

function getStatusBadge(status: SubscriptionStatus) {
  switch (status) {
    case 'active':
      return { label: 'Ativa', className: 'bg-green-100 text-green-800 hover:bg-green-100' };
    case 'trialing':
      return { label: 'Período de teste', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' };
    case 'past_due':
      return { label: 'Pagamento pendente', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' };
    case 'canceled':
      return { label: 'Cancelada', className: 'bg-red-100 text-red-800 hover:bg-red-100' };
    default:
      return { label: 'Inativa', className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' };
  }
}

function formatPeriodEnd(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function SubscriptionStatusCard({
  status,
  periodEnd,
  cancelAtPeriodEnd,
  subscriptionProvider = 'stripe',
  hasStripeSubscription = false,
  isLoading = false,
  isSwitchingToPix = false,
  isRevertingToStripe = false,
  onSubscribe,
  onPixSubscribe,
  onSwitchToPix,
  onRevertToStripe,
}: SubscriptionStatusCardProps) {
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const badge = getStatusBadge(status);
  const isActive = status === 'active' || status === 'trialing';
  const isPastDue = status === 'past_due';
  // Stripe ativo sem cancelamento pendente → renovação automática normal
  const isStripeActive = isActive && subscriptionProvider === 'stripe' && !cancelAtPeriodEnd;
  // Stripe com cancel_at_period_end (via portal Stripe ou migração pendente sem PIX)
  const isStripeCancelling = isActive && subscriptionProvider === 'stripe' && cancelAtPeriodEnd;
  // Migração para PIX já iniciada — aguardando pagamento PIX
  const isPixPending = isActive && subscriptionProvider === 'pix_manual' && cancelAtPeriodEnd;

  async function handlePortal() {
    setLoadingPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao abrir portal');
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao abrir portal. Tente novamente.'
      );
      setLoadingPortal(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manutenção Mensal
          </CardTitle>
          {isLoading ? (
            <Skeleton className="h-6 w-24 rounded-full" />
          ) : (
            <Badge variant="outline" className={badge.className}>
              {badge.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-2xl font-bold">R$ 300,00<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
          <p className="text-sm text-muted-foreground">Sistema online, suporte técnico e atualizações</p>
        </div>

        {isLoading ? (
          <div className="flex gap-2">
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>
        ) : (
          <>
            {isActive && periodEnd && (
              <p className="text-sm text-muted-foreground">
                {isPixPending
                  ? `Cancela em ${formatPeriodEnd(periodEnd)} — aguardando pagamento PIX`
                  : isStripeCancelling
                    ? `Cancela em ${formatPeriodEnd(periodEnd)} — cancelado pelo portal`
                    : `Renova em ${formatPeriodEnd(periodEnd)}`
                }
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {isActive && hasStripeSubscription && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePortal}
                  disabled={loadingPortal}
                >
                  {loadingPortal ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Gerenciar Assinatura
                </Button>
              )}

              {/* Migrar para PIX: apenas para assinantes Stripe ativos sem cancelamento pendente */}
              {isStripeCancelling && onSwitchToPix && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSwitchToPix}
                  disabled={isSwitchingToPix || loadingPortal}
                >
                  {isSwitchingToPix ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4 mr-2" />
                  )}
                  Pagar próximo mês com PIX
                </Button>
              )}

              {isStripeActive && onSwitchToPix && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSwitchToPix}
                  disabled={isSwitchingToPix || loadingPortal}
                >
                  {isSwitchingToPix ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4 mr-2" />
                  )}
                  Pagar próximo mês com PIX
                </Button>
              )}

              {/* Estado: migração iniciada, aguardando pagamento PIX */}
              {isPixPending && (
                <>
                  {onPixSubscribe && (
                    <Button
                      size="sm"
                      onClick={onPixSubscribe}
                      disabled={isRevertingToStripe}
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      Gerar novo PIX
                    </Button>
                  )}
                  {onRevertToStripe && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmRevert(true)}
                        disabled={isRevertingToStripe}
                      >
                        {isRevertingToStripe ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CreditCard className="h-4 w-4 mr-2" />
                        )}
                        Manter cobrança no cartão
                      </Button>

                      <AlertDialog open={confirmRevert} onOpenChange={setConfirmRevert}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Manter cobrança no cartão?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sua assinatura voltará a ser renovada automaticamente no cartão na data de vencimento. O PIX gerado anteriormente não será mais necessário.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={onRevertToStripe}>
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </>
              )}

              {isPastDue && (
                <>
                  <Button size="sm" onClick={handlePortal} disabled={loadingPortal}>
                    {loadingPortal ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Pagar com Cartão
                  </Button>
                  {onPixSubscribe && (
                    <Button size="sm" variant="outline" onClick={onPixSubscribe}>
                      <QrCode className="h-4 w-4 mr-2" />
                      Pagar com PIX
                    </Button>
                  )}
                </>
              )}

              {(status === 'canceled' || status === 'inactive') && (
                <div className="flex flex-wrap gap-2">
                  {onSubscribe && (
                    <Button size="sm" onClick={onSubscribe}>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Assinar com Cartão
                    </Button>
                  )}
                  {onPixSubscribe && (
                    <Button size="sm" variant="outline" onClick={onPixSubscribe}>
                      <QrCode className="h-4 w-4 mr-2" />
                      Assinar com PIX
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
