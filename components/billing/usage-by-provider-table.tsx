'use client';

import { Activity, Zap, MessageSquare, Volume2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { UsageSummary } from '@/types/billing';
import { formatBRL } from '@/types/billing';

interface UsageByProviderTableProps {
  data: UsageSummary[];
  isLoading: boolean;
}

/**
 * Retorna ícone do provider
 */
function getProviderIcon(provider: string) {
  switch (provider.toLowerCase()) {
    case 'openai':
      return Zap;
    case 'anthropic':
      return MessageSquare;
    case 'elevenlabs':
      return Volume2;
    default:
      return Activity;
  }
}

/**
 * Retorna cor do provider
 */
function getProviderColor(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'openai':
      return 'text-green-600';
    case 'anthropic':
      return 'text-orange-600';
    case 'elevenlabs':
      return 'text-purple-600';
    default:
      return 'text-blue-600';
  }
}

/**
 * Tabela de Consumo por Provider
 */
export function UsageByProviderTable({
  data,
  isLoading,
}: UsageByProviderTableProps) {
  // Calcula total para percentuais
  const totalCredits = data.reduce((sum, item) => sum + item.debited_credits, 0);

  // Loading state
  if (isLoading && data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Consumo por Serviço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Consumo por Serviço
          </CardTitle>
          <CardDescription>Detalhamento por provider e modelo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum consumo registrado no período</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Consumo por Serviço
        </CardTitle>
        <CardDescription>Detalhamento por provider e modelo</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead>Modelo/SKU</TableHead>
              <TableHead className="text-right">Chamadas</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[120px]">% do Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => {
              const Icon = getProviderIcon(item.provider);
              const colorClass = getProviderColor(item.provider);
              const percent =
                totalCredits > 0
                  ? (item.debited_credits / totalCredits) * 100
                  : 0;

              return (
                <TableRow key={`${item.provider}-${item.sku}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${colorClass}`} />
                      <span className="font-medium capitalize">
                        {item.provider}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.sku}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.calls.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatBRL(item.debited_brl)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={percent} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {percent.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}
