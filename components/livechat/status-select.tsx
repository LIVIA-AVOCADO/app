/**
 * StatusSelect Component
 *
 * Select customizado para alterar status de uma conversa
 *
 * Features:
 * - Permite alternar entre: Ativa (open), Aguardando (paused), Encerrada (closed)
 * - Todas as transições permitidas
 * - Atualiza via API
 * - UI otimista com feedback de loading e erro
 * - Sincronização com realtime via useEffect
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CONVERSATION_STATUS } from '@/config/constants';
import type { ConversationStatus } from '@/types/database-helpers';

interface StatusSelectProps {
  conversationId: string;
  tenantId: string;
  currentStatus: ConversationStatus;
  disabled?: boolean;
  onStatusChange?: (newStatus: ConversationStatus) => void;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  [CONVERSATION_STATUS.OPEN]: {
    label: 'Ativa',
    badgeClass: 'bg-green-600 text-white',
  },
  [CONVERSATION_STATUS.CLOSED]: {
    label: 'Encerrada',
    badgeClass: 'bg-gray-600 text-white',
  },
};

export function StatusSelect({
  conversationId,
  tenantId,
  currentStatus,
  disabled = false,
  onStatusChange,
}: StatusSelectProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState<ConversationStatus>(currentStatus);

  // Sincronizar com props quando status mudar (realtime)
  useEffect(() => {
    setSelectedValue(currentStatus);
  }, [currentStatus]);

  const handleStatusChange = async (value: string) => {
    if (isLoading) return;

    const newStatus = value as ConversationStatus;

    // Não fazer nada se o status for o mesmo
    if (newStatus === currentStatus) return;

    setIsLoading(true);
    setSelectedValue(newStatus); // UI otimista no select
    onStatusChange?.(newStatus); // Atualiza o painel de conversas imediatamente

    try {
      const response = await fetch('/api/conversations/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          status: newStatus,
          tenantId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar status');
      }

      toast.success('Status atualizado com sucesso');
    } catch (error) {
      console.error('[StatusSelect] Error:', error);

      // Reverter para valor anterior (no select e no painel)
      setSelectedValue(currentStatus);
      onStatusChange?.(currentStatus);

      toast.error(
        error instanceof Error ? error.message : 'Erro ao atualizar status'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const currentConfig = STATUS_CONFIG[selectedValue] || {
    label: selectedValue,
    badgeClass: 'bg-gray-400 text-white',
  };

  return (
    <Select
      value={selectedValue}
      onValueChange={handleStatusChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className="w-[160px] h-7 text-xs transition-opacity duration-200">
        <SelectValue>
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs text-muted-foreground">Salvando...</span>
            </span>
          ) : (
            <Badge
              variant="default"
              className={`${currentConfig.badgeClass} transition-colors duration-300`}
            >
              {currentConfig.label}
            </Badge>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <SelectItem key={status} value={status}>
            <Badge
              variant="default"
              className={config.badgeClass}
            >
              {config.label}
            </Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
