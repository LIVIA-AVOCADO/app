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
import { toast } from 'sonner';
import type { SubscriptionStatus } from '@/types/stripe';

interface SubscriptionStatusCardProps {
  status: SubscriptionStatus;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  onSubscribe?: () => void;
  onPixSubscribe?: () => void;
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
  onSubscribe,
  onPixSubscribe,
}: SubscriptionStatusCardProps) {
  const [loadingPortal, setLoadingPortal] = useState(false);
  const badge = getStatusBadge(status);
  const isActive = status === 'active' || status === 'trialing';
  const isPastDue = status === 'past_due';

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
          <Badge variant="outline" className={badge.className}>
            {badge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-2xl font-bold">R$ 300,00<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
          <p className="text-sm text-muted-foreground">Sistema online, suporte técnico e atualizações</p>
        </div>

        {isActive && periodEnd && (
          <p className="text-sm text-muted-foreground">
            {cancelAtPeriodEnd
              ? `Cancela em ${formatPeriodEnd(periodEnd)}`
              : `Renova em ${formatPeriodEnd(periodEnd)}`
            }
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {isActive && (
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
      </CardContent>
    </Card>
  );
}
