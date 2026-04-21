'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TagBadge } from '@/components/shared/tag-badge';
import { toast } from 'sonner';
import type { Tag } from '@/types/database-helpers';
import { TagTypeSection } from './tag-type-section';

export type TagSelectorMode = 'assign' | 'filter';

interface TagSelectorProps {
  // Modo de operação
  mode: TagSelectorMode;

  // Tags selecionadas (assign: tags da conversa, filter: tags do filtro)
  selectedTags: Tag[];

  // Todas as tags disponíveis do neurocore
  availableTags: Tag[];

  // Callback quando tag é adicionada/removida
  onTagToggle: (tagId: string) => void | Promise<void>;

  // Loading state global
  isLoading?: boolean;

  // Desabilitar interação
  disabled?: boolean;

  // Placeholder do botão
  placeholder?: string;

  // ID da conversa (apenas para modo assign)
  conversationId?: string;

  // ID do tenant (apenas para modo assign)
  tenantId?: string;

  // Lado do popover (útil quando o trigger fica próximo à borda da tela)
  popoverSide?: 'top' | 'right' | 'bottom' | 'left';
}

export function TagSelector({
  mode,
  selectedTags,
  availableTags,
  onTagToggle,
  isLoading = false,
  disabled = false,
  placeholder,
  conversationId,
  tenantId,
  popoverSide = 'bottom',
}: TagSelectorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingTags, setLoadingTags] = useState<Set<string>>(new Set());
  const [optimisticallyRemovedTags, setOptimisticallyRemovedTags] = useState<Set<string>>(new Set());
  const [optimisticallyAddedTags, setOptimisticallyAddedTags] = useState<Map<string, Tag>>(new Map());

  // Agrupar tags disponíveis por tipo
  const tagsByType = {
    description: availableTags.filter(t => t.tag_type === 'description'),
    success: availableTags.filter(t => t.tag_type === 'success'),
    fail: availableTags.filter(t => t.tag_type === 'fail'),
  };

  // IDs das tags selecionadas para busca rápida
  // Filtrar tags nulas defensivamente
  const selectedTagIds = useMemo(
    () => new Set(selectedTags.filter(t => t !== null && t !== undefined).map(t => t.id)),
    [selectedTags]
  );

  // Limpar estados otimistas quando as tags reais forem atualizadas
  useEffect(() => {
    // Limpar tags adicionadas otimisticamente que agora estão em selectedTags
    setOptimisticallyAddedTags(prev => {
      const next = new Map(prev);
      let changed = false;
      for (const tagId of next.keys()) {
        if (selectedTagIds.has(tagId)) {
          next.delete(tagId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    // Limpar tags removidas otimisticamente que não estão mais em selectedTags
    setOptimisticallyRemovedTags(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const tagId of next) {
        if (!selectedTagIds.has(tagId)) {
          next.delete(tagId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedTagIds]);

  // Filtrar tags disponíveis (remover as já selecionadas em modo assign)
  const getAvailableTagsForType = (type: 'description' | 'success' | 'fail') => {
    const tags = tagsByType[type];
    if (mode === 'assign') {
      return tags.filter(t => !selectedTagIds.has(t.id));
    }
    return tags;
  };

  // Handle toggle de tag
  const handleTagToggle = async (tagId: string) => {
    // Se já está carregando, ignorar
    if (loadingTags.has(tagId) || isLoading) return;

    if (mode === 'assign') {
      // Modo assign: chamar API
      // Verificar se está adicionando ou removendo
      const isRemoving = selectedTagIds.has(tagId);

      if (isRemoving) {
        // Optimistic update: remover imediatamente da UI
        setOptimisticallyRemovedTags(prev => new Set([...prev, tagId]));
      } else {
        // Optimistic update: adicionar imediatamente à UI
        const tagToAdd = availableTags.find(t => t.id === tagId);
        if (tagToAdd) {
          setOptimisticallyAddedTags(prev => new Map([...prev, [tagId, tagToAdd]]));
        }
      }

      try {
        // Chamar API
        const response = await fetch('/api/conversations/update-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            tagId: isRemoving ? null : tagId,
            tagIdToRemove: isRemoving ? tagId : null,
            tenantId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao atualizar tag');
        }

        // Mostrar toast de confirmação
        toast.success(data.message);

        // Revalidar (vai atualizar com dados reais do servidor)
        // O useEffect vai limpar os estados otimistas quando os dados reais chegarem
        router.refresh();

        // Fechar popover após adicionar tag (opcional)
        if (!isRemoving) {
          // setIsOpen(false);
        }
      } catch (error) {
        console.error('[TagSelector] Error:', error);
        
        // Reverter optimistic update em caso de erro
        if (isRemoving) {
          setOptimisticallyRemovedTags(prev => {
            const next = new Set(prev);
            next.delete(tagId);
            return next;
          });
        } else {
          setOptimisticallyAddedTags(prev => {
            const next = new Map(prev);
            next.delete(tagId);
            return next;
          });
        }
        
        toast.error(
          error instanceof Error ? error.message : 'Erro ao atualizar tag'
        );
      } finally {
        setLoadingTags(prev => {
          const next = new Set(prev);
          next.delete(tagId);
          return next;
        });
      }
    } else {
      // Modo filter: apenas callback local
      onTagToggle(tagId);
    }
  };

  // Placeholder padrão
  const defaultPlaceholder = mode === 'assign'
    ? 'Adicionar tags'
    : 'Filtrar por tags';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-2 flex-wrap border rounded-lg p-2 min-h-[44px] cursor-pointer hover:bg-accent/50 transition-colors">
          {/* Tags selecionadas (combinando reais + otimisticamente adicionadas - otimisticamente removidas) */}
          {(() => {
            // Combinar tags reais com otimisticamente adicionadas (evitando duplicatas)
            const tagMap = new Map<string, Tag>();
            
            // Adicionar tags reais
            selectedTags.forEach(tag => tagMap.set(tag.id, tag));
            
            // Adicionar tags otimisticamente adicionadas (sobrescreve se já existir)
            optimisticallyAddedTags.forEach((tag, id) => tagMap.set(id, tag));
            
            // Filtrar as removidas otimisticamente
            const visibleTags = Array.from(tagMap.values()).filter(
              tag => !optimisticallyRemovedTags.has(tag.id)
            );
            
            return visibleTags.length > 0 ? visibleTags.map((tag) => (
              <div
                key={tag.id}
                className="group relative"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTagToggle(tag.id);
                }}
              >
                {loadingTags.has(tag.id) ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">{tag.tag_name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-destructive/10 transition-colors cursor-pointer">
                    <TagBadge tag={tag} size="sm" />
                    <X className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>
            )) : null;
          })()}

          {/* Botão adicionar */}
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2"
            disabled={disabled || isLoading}
          >
            <Plus className="h-4 w-4 mr-1" />
            <span className="text-sm">{placeholder || defaultPlaceholder}</span>
          </Button>
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0"
        align="start"
        side={popoverSide}
        sideOffset={8}
        collisionPadding={8}
      >
        <div className="p-3 border-b">
          <h4 className="font-semibold text-sm">
            {mode === 'assign' ? 'Tags Disponíveis' : 'Filtrar por Tags'}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {mode === 'assign'
              ? 'Clique para adicionar à conversa'
              : 'Selecione as tags para filtrar'}
          </p>
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="p-3 space-y-4">
            {/* Seção: Intenção */}
            <TagTypeSection
              type="description"
              label="Intenção"
              tags={getAvailableTagsForType('description')}
              selectedTagIds={selectedTagIds}
              loadingTags={loadingTags}
              mode={mode}
              onTagClick={handleTagToggle}
            />

            {/* Separator */}
            {tagsByType.success.length > 0 && (
              <Separator className="my-2" />
            )}

            {/* Seção: Checkout */}
            <TagTypeSection
              type="success"
              label="Checkout"
              tags={getAvailableTagsForType('success')}
              selectedTagIds={selectedTagIds}
              loadingTags={loadingTags}
              mode={mode}
              onTagClick={handleTagToggle}
            />

            {/* Separator */}
            {tagsByType.fail.length > 0 && (
              <Separator className="my-2" />
            )}

            {/* Seção: Falha */}
            <TagTypeSection
              type="fail"
              label="Falha"
              tags={getAvailableTagsForType('fail')}
              selectedTagIds={selectedTagIds}
              loadingTags={loadingTags}
              mode={mode}
              onTagClick={handleTagToggle}
            />

            {/* Mensagem se não houver tags */}
            {availableTags.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma tag disponível
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
