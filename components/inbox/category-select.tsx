/**
 * CategorySelect Component
 *
 * Select customizado para escolher categoria de uma conversa
 *
 * Features:
 * - Lista categorias disponíveis (tags com is_category=true)
 * - Exibe badge com cor
 * - Permite remover categoria (opção "Nenhuma")
 * - Atualiza via API
 * - Feedback de loading e erro
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

interface CategorySelectProps {
  conversationId: string;
  tenantId: string;
  currentCategory?: Tag | null;
  categories: Tag[];
  disabled?: boolean;
}

export function CategorySelect({
  conversationId,
  tenantId,
  currentCategory,
  categories,
  disabled = false,
}: CategorySelectProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string>(
    currentCategory?.id || 'none'
  );

  // Sincronizar com props quando categoria mudar (realtime)
  useEffect(() => {
    setSelectedValue(currentCategory?.id || 'none');
  }, [currentCategory]);

  const handleCategoryChange = async (value: string) => {
    if (isLoading) return;

    setIsLoading(true);
    setSelectedValue(value); // UI otimista

    try {
      const categoryId = value === 'none' ? null : value;

      const response = await fetch('/api/conversations/update-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          categoryId,
          tenantId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar categoria');
      }

      toast.success(
        categoryId
          ? 'Categoria definida com sucesso'
          : 'Categoria removida com sucesso'
      );

      // Revalidar para buscar dados atualizados
      router.refresh();
    } catch (error) {
      console.error('[CategorySelect] Error:', error);

      // Reverter para valor anterior
      setSelectedValue(currentCategory?.id || 'none');

      toast.error(
        error instanceof Error ? error.message : 'Erro ao atualizar categoria'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Select
      value={selectedValue}
      onValueChange={handleCategoryChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Selecionar categoria">
          {selectedValue === 'none' ? (
            <span className="text-muted-foreground">Nenhuma categoria</span>
          ) : (
            currentCategory && <TagBadge tag={currentCategory} size="sm" />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="text-muted-foreground">Nenhuma categoria</span>
        </SelectItem>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            <TagBadge tag={category} size="sm" />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
