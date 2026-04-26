'use client';

import { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { Bot, User, DollarSign, Pencil, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RelativeTime } from '@/components/ui/relative-time';
import { getContactDisplayName } from '@/lib/utils/contact-helpers';
import { cn } from '@/lib/utils';
import type { ConversationWithPipelineAndContact } from '@/types/crm';

interface Props {
  conversation: ConversationWithPipelineAndContact;
}

export function PipelineConversationCard({ conversation }: Props) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: conversation.id,
    data: { conversation },
  });

  const [dealValue, setDealValue] = useState<number | null>(conversation.deal_value);
  const [editingDeal, setEditingDeal] = useState(false);
  const [dealInput, setDealInput] = useState('');
  const dealInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingDeal) {
      setDealInput(dealValue != null ? String(dealValue) : '');
      setTimeout(() => dealInputRef.current?.focus(), 50);
    }
  }, [editingDeal, dealValue]);

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const Icon = conversation.ia_active ? Bot : User;
  const displayName = getContactDisplayName(conversation.contact.name, conversation.contact.phone);
  const timestamp = conversation.last_message_at || conversation.created_at;

  const statusConfig = (() => {
    if (conversation.status === 'closed') return { label: 'Encerrada', className: 'bg-gray-500' };
    if (conversation.ia_active) return { label: 'IA Ativa', className: 'bg-green-500' };
    return { label: 'Manual', className: 'bg-blue-500' };
  })();

  const handleCardClick = (e: React.MouseEvent) => {
    if (isDragging || editingDeal) return;
    e.stopPropagation();
    router.push(`/inbox?conversation=${conversation.id}`);
  };

  const openDealEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDeal(true);
  };

  const saveDeal = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const parsed = dealInput.trim() === '' ? null : parseFloat(dealInput.replace(',', '.'));
    const newVal = parsed != null && !isNaN(parsed) ? parsed : null;
    setDealValue(newVal);
    setEditingDeal(false);

    await fetch('/api/crm/pipeline/deal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversation.id,
        deal_value: newVal,
        deal_currency: 'BRL',
      }),
    });
  };

  const cancelDeal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDeal(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={cn(
        'p-3 border rounded-lg bg-card select-none group',
        'transition-shadow duration-150',
        'hover:border-primary hover:shadow-md',
        isDragging && 'shadow-xl ring-2 ring-primary/50'
      )}
    >
      {/* Name + status */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-medium truncate">{displayName}</span>
        <Badge className={cn('text-[10px] px-2 py-0 flex-shrink-0', statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Deal value row */}
      {editingDeal ? (
        <div
          className="flex items-center gap-1 mb-2"
          onClick={(e) => e.stopPropagation()}
        >
          <DollarSign className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <Input
            ref={dealInputRef}
            type="number"
            min="0"
            step="0.01"
            value={dealInput}
            onChange={(e) => setDealInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveDeal();
              if (e.key === 'Escape') cancelDeal(e as any);
            }}
            className="h-6 text-xs px-1.5 py-0 w-28"
            placeholder="0,00"
          />
          <button onClick={saveDeal} className="text-green-500 hover:text-green-400">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={cancelDeal} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 mb-2 min-h-[20px]">
          {dealValue != null ? (
            <>
              <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                R$ {dealValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <button
                onClick={openDealEdit}
                className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </>
          ) : (
            <button
              onClick={openDealEdit}
              className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground flex items-center gap-1"
            >
              <DollarSign className="h-3 w-3" />
              Definir valor
            </button>
          )}
        </div>
      )}

      {/* Footer: icon + timestamp */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        <RelativeTime timestamp={timestamp} />
      </div>
    </div>
  );
}
