'use client';

import { useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { replaceQuickReplyVariables } from '@/lib/utils/quick-replies';
import { useQuickRepliesCache } from '@/hooks/use-quick-replies-cache';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { QuickReply } from '@/types/livechat';
import type { QuickReplyMode } from '@/hooks/use-quick-reply-command';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface QuickReplyCommandProps {
  isOpen: boolean;
  onClose: () => void;
  mode: QuickReplyMode;
  tenantId: string;
  contactName: string;
  conversationId: string;
  onSelect: (content: string, quickReplyId: string) => void;
}

/**
 * Command Palette para seleção de respostas rápidas.
 *
 * Modos:
 * - 'all': Exibe todas as respostas rápidas ativas
 * - 'popular': Exibe apenas as 5 respostas mais populares
 */
export function QuickReplyCommand({
  isOpen,
  onClose,
  mode,
  tenantId,
  contactName,
  conversationId,
  onSelect,
}: QuickReplyCommandProps) {
  // State para busca (apenas para modo "all")
  const [searchValue, setSearchValue] = useState('');

  // Debounce da busca (300ms) - só para modo "all"
  const debouncedSearch = useDebouncedValue(searchValue, 300);

  // Hook otimizado com cache e paginação
  const {
    quickReplies: allQuickReplies,
    popularQuickReplies,
    total,
    hasMore,
    isLoading,
    isError,
    loadMore,
  } = useQuickRepliesCache({
    tenantId,
    limit: mode === 'popular' ? 5 : 50, // Popular: 5, All: 50 primeiros (otimizado)
    search: mode === 'all' ? debouncedSearch : undefined, // Busca server-side apenas para "all"
    enabled: isOpen, // Só carrega quando command está aberto
    onError: (error) => {
      console.error('Erro ao carregar respostas rápidas:', error);
      toast.error('Erro ao carregar respostas rápidas');
    },
  });

  // Seleciona dados baseado no modo
  const quickReplies = mode === 'popular' ? popularQuickReplies : allQuickReplies;

  const handleSelect = (quickReply: QuickReply) => {
    // Processa variáveis no conteúdo
    const processedContent = replaceQuickReplyVariables(quickReply.content, {
      contactName,
      conversationId,
    });

    // Chama callback de seleção
    onSelect(processedContent, quickReply.id);

    // Incrementa contador de uso (fire-and-forget)
    incrementUsage(quickReply.id);

    // Fecha o command
    onClose();
  };

  const incrementUsage = async (quickReplyId: string) => {
    try {
      await fetch('/api/quick-replies/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quickReplyId,
          tenantId,
        }),
      });
    } catch (error) {
      // Fire-and-forget, não mostra erro ao usuário
      console.error('Erro ao incrementar uso:', error);
    }
  };

  const getTitle = () => {
    if (mode === 'popular') {
      return 'Respostas Rápidas Populares';
    }
    return 'Respostas Rápidas';
  };

  const getDescription = () => {
    if (mode === 'popular') {
      return 'Selecione uma das respostas mais utilizadas';
    }
    return 'Busque e selecione uma resposta rápida';
  };

  const getGroupLabel = () => {
    if (mode === 'popular') {
      return '⚡ Mais Utilizadas';
    }
    return 'Todas as Respostas';
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setSearchValue(''); // Limpa busca ao fechar
          onClose();
        }
      }}
      title={getTitle()}
      description={getDescription()}
    >
      <CommandInput
        placeholder={
          mode === 'popular'
            ? 'Buscar nas populares...'
            : 'Buscar resposta rápida...'
        }
        value={searchValue}
        onValueChange={setSearchValue}
      />
      <CommandList>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : isError ? (
          <div className="py-6 text-center text-sm text-destructive">
            Erro ao carregar respostas. Tente novamente.
          </div>
        ) : (
          <>
            <CommandEmpty>Nenhuma resposta encontrada.</CommandEmpty>
            <CommandGroup heading={getGroupLabel()}>
              {quickReplies.map((reply) => (
                <CommandItem
                  key={reply.id}
                  value={`${reply.title} ${reply.content}`}
                  onSelect={() => handleSelect(reply)}
                  className="flex items-start gap-2 cursor-pointer"
                >
                  {/* Emoji ou ícone padrão */}
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {reply.emoji || (mode === 'popular' ? '⚡' : '💬')}
                  </span>

                  {/* Conteúdo com tooltip ao hover */}
                  <Tooltip delayDuration={600}>
                    <TooltipTrigger asChild>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{reply.title}</span>
                          {mode === 'popular' && (
                            <span className="text-xs text-muted-foreground">
                              {reply.usage_count}x
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {reply.content.length > 60
                            ? `${reply.content.substring(0, 60)}...`
                            : reply.content}
                        </p>
                      </div>
                    </TooltipTrigger>
                    {reply.content.length > 60 && (
                      <TooltipContent
                        side="right"
                        sideOffset={8}
                        className="max-w-xs"
                      >
                        <div className="max-h-48 overflow-y-auto">
                          <p className="font-semibold mb-1">{reply.title}</p>
                          <p className="whitespace-pre-wrap break-words text-xs">{reply.content}</p>
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Footer com contador e botão "Carregar mais" (apenas modo "all") */}
            {mode === 'all' && quickReplies.length > 0 && (
              <div className="border-t px-4 py-3 flex items-center justify-between bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Mostrando {quickReplies.length} de {total} respostas
                </p>
                {hasMore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMore}
                    disabled={isLoading}
                    className="h-7 text-xs"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        Carregar mais ({total - quickReplies.length} restantes)
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
