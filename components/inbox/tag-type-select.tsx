/**
 * TagTypeSelect Component
 *
 * Select para escolher tag de um tipo específico (description, success, fail)
 *
 * Features:
 * - Filtra tags por tipo automaticamente
 * - Permite remover tag (opção "Nenhuma")
 * - Atualiza via nova API /api/conversations/update-tag
 * - Feedback de loading e erro
 * - Suporta múltiplas tags por conversa (desde que sejam de tipos diferentes)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagBadge } from '@/components/shared/tag-badge';
import { toast } from 'sonner';
import type { Tag } from '@/types/database-helpers';

type TagType = 'description' | 'success' | 'fail';

interface TagTypeSelectProps {
  conversationId: string;
  tenantId: string;
  tagType: TagType;
  currentTag?: Tag | null;
  availableTags: Tag[]; // Todas as tags do tenant
  disabled?: boolean;
  label?: string;
}

const TAG_TYPE_LABELS: Record<TagType, string> = {
  description: 'Intenção',
  success: 'Checkout (Sucesso)',
  fail: 'Falha',
};

export function TagTypeSelect({
  conversationId,
  tenantId,
  tagType,
  currentTag,
  availableTags,
  disabled = false,
  label,
}: TagTypeSelectProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string>(
    currentTag?.id || 'none'
  );

  // Filtrar tags do tipo específico
  const tagsOfType = availableTags.filter(tag => tag.tag_type === tagType);

  // Encontrar tag selecionada atual
  const selectedTag = tagsOfType.find(tag => tag.id === selectedValue);

  // Sincronizar com props quando tag mudar (realtime)
  useEffect(() => {
    setSelectedValue(currentTag?.id || 'none');
  }, [currentTag]);

  const handleTagChange = async (value: string) => {
    if (isLoading) return;

    setIsLoading(true);
    setSelectedValue(value); // UI otimista

    try {
      const tagId = value === 'none' ? null : value;

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
      console.error('[TagTypeSelect] Error:', error);

      // Reverter para valor anterior
      setSelectedValue(currentTag?.id || 'none');

      toast.error(
        error instanceof Error ? error.message : 'Erro ao atualizar tag'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Se não houver tags do tipo específico, não renderizar nada
  if (tagsOfType.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <Select
        value={selectedValue}
        onValueChange={handleTagChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Selecionar ${TAG_TYPE_LABELS[tagType].toLowerCase()}`}>
            {selectedValue === 'none' ? (
              <span className="text-muted-foreground">
                Sem {TAG_TYPE_LABELS[tagType].toLowerCase()}
              </span>
            ) : selectedTag ? (
              <TagBadge tag={selectedTag} size="sm" />
            ) : (
              <span className="text-muted-foreground">Carregando...</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">
              Sem {TAG_TYPE_LABELS[tagType].toLowerCase()}
            </span>
          </SelectItem>
          {tagsOfType.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              <TagBadge tag={tag} size="sm" />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
