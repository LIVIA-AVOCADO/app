/**
 * TagCheckbox Component
 *
 * Checkbox para tags binárias (success/checkout)
 * Mais simples e intuitivo que um dropdown quando há apenas uma opção
 *
 * Features:
 * - Toggle on/off (aplicar ou remover tag)
 * - Feedback visual com badge quando ativo
 * - Loading state
 * - Suporta múltiplas tags de checkout (escolhe a primeira disponível)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { TagBadge } from '@/components/shared/tag-badge';
import { toast } from 'sonner';
import type { Tag } from '@/types/database-helpers';

type TagType = 'success' | 'fail';

interface TagCheckboxProps {
  conversationId: string;
  tenantId: string;
  tagType: TagType;
  currentTag?: Tag | null;
  availableTags: Tag[]; // Todas as tags do tenant
  disabled?: boolean;
  label?: string;
}

const TAG_TYPE_LABELS: Record<TagType, string> = {
  success: 'Checkout Realizado',
  fail: 'Marcado como Falha',
};

export function TagCheckbox({
  conversationId,
  tenantId,
  tagType,
  currentTag,
  availableTags,
  disabled = false,
  label,
}: TagCheckboxProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecked, setIsChecked] = useState(!!currentTag);

  // Sincronizar com props quando tag mudar (realtime)
  useEffect(() => {
    setIsChecked(!!currentTag);
  }, [currentTag]);

  // Filtrar tags do tipo específico
  const tagsOfType = availableTags.filter(tag => tag.tag_type === tagType);

  // Se não houver tags desse tipo, não renderizar
  if (tagsOfType.length === 0) {
    return null;
  }

  // Usar a primeira tag disponível do tipo
  const defaultTag = tagsOfType[0];

  // Safety check (não deveria acontecer devido ao if acima)
  if (!defaultTag) {
    return null;
  }

  const handleToggle = async (checked: boolean) => {
    if (isLoading) return;

    setIsLoading(true);
    setIsChecked(checked); // UI otimista

    try {
      // Se checked=true, aplicar a primeira tag disponível
      // Se checked=false, remover tag (tagId=null)
      const tagId = checked ? defaultTag.id : null;

      const response = await fetch('/api/conversations/update-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          tagId,
          tenantId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar tag');
      }

      toast.success(data.message);

      // Revalidar para buscar dados atualizados
      router.refresh();
    } catch (error) {
      console.error('[TagCheckbox] Error:', error);

      // Reverter para valor anterior
      setIsChecked(!!currentTag);

      toast.error(
        error instanceof Error ? error.message : 'Erro ao atualizar tag'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={`tag-checkbox-${tagType}`}
        checked={isChecked}
        onCheckedChange={handleToggle}
        disabled={disabled || isLoading}
      />
      <label
        htmlFor={`tag-checkbox-${tagType}`}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
      >
        {label || TAG_TYPE_LABELS[tagType]}
        {isChecked && currentTag && (
          <TagBadge tag={currentTag} size="sm" />
        )}
      </label>
    </div>
  );
}
