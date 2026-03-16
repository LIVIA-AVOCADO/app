'use client';

import { useState } from 'react';
import { Zap, Search, Plus, MoreVertical, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { QuickReplyDialog } from './quick-reply-dialog';
import { replaceQuickReplyVariables } from '@/lib/utils/quick-replies';
import { useQuickRepliesCache } from '@/hooks/use-quick-replies-cache';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { toast } from 'sonner';
import type { QuickReply } from '@/types/livechat';
import { useApiCall } from '@/lib/hooks';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface QuickRepliesPanelProps {
  conversationId: string;
  tenantId: string;
  contactName: string;
  onSelect: (message: string) => void;
  disabled?: boolean;
}

export function QuickRepliesPanel({
  conversationId,
  tenantId,
  contactName,
  onSelect,
  disabled = false,
}: QuickRepliesPanelProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300); // Debounce para busca server-side

  // Estados para dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReply, setDeletingReply] = useState<QuickReply | null>(null);

  // API calls hooks
  const trackUsage = useApiCall('/api/quick-replies/usage', 'POST', {
    suppressSuccessToast: true,
    suppressErrorToast: true, // Fire-and-forget, não mostrar erro ao usuário
  });

  const deleteQuickReply = useApiCall(`/api/quick-replies/${deletingReply?.id}`, 'DELETE', {
    successMessage: 'Quick reply deletada com sucesso!',
    errorMessage: 'Erro ao deletar quick reply',
    onSuccess: () => {
      refetch(); // Invalida cache e recarrega
      setDeleteDialogOpen(false);
      setDeletingReply(null);
    },
  });

  // Hook otimizado com cache e busca server-side
  const {
    quickReplies,
    total,
    hasMore,
    isLoading,
    refetch,
    loadMore,
  } = useQuickRepliesCache({
    tenantId,
    limit: 20, // 20 por página
    search: debouncedSearch, // Busca debounced server-side
    enabled: open, // Só carrega quando popover está aberto
    onError: (error) => {
      console.error('Erro ao carregar quick replies:', error);
      toast.error('Erro ao carregar quick replies');
    },
  });

  const handleSelect = (quickReply: QuickReply) => {
    // Substituir variáveis dinâmicas
    const processedMessage = replaceQuickReplyVariables(quickReply.content, {
      contactName,
      conversationId,
    });

    // Inserir mensagem no input
    onSelect(processedMessage);

    // Incrementar contador de uso (fire-and-forget)
    trackUsage.execute({
      quickReplyId: quickReply.id,
      tenantId,
    });

    // Fechar popover
    setOpen(false);
    setSearch('');
  };

  // Handler para abrir dialog de criar
  const handleOpenCreateDialog = () => {
    setEditingReply(null);
    setDialogOpen(true);
  };

  // Handler para abrir dialog de editar
  const handleOpenEditDialog = (quickReply: QuickReply) => {
    setEditingReply(quickReply);
    setDialogOpen(true);
  };

  // Handler para fechar dialog
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingReply(null);
  };

  // Handler de sucesso (criar/editar)
  const handleSuccess = () => {
    refetch(); // Invalida cache e recarrega
  };

  // Handler para abrir dialog de deletar
  const handleOpenDeleteDialog = (quickReply: QuickReply) => {
    setDeletingReply(quickReply);
    setDeleteDialogOpen(true);
  };

  // Handler para deletar
  const handleDelete = async () => {
    if (!deletingReply) return;
    await deleteQuickReply.execute();
  };

  // Top 3 mais usadas da primeira página
  const top3Ids = quickReplies
    .slice(0, 3)
    .map((reply) => reply.id);

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          title="Quick Replies (Respostas Rápidas)"
          className="h-[60px] w-[60px]"
        >
          <Zap className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0"
        align="start"
        side="top"
      >
        <Command shouldFilter={false}>
          {/* Header com título e botão adicionar */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <h3 className="text-sm font-semibold">Quick Replies</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenCreateDialog();
              }}
              title="Adicionar nova quick reply"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Campo de busca */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 opacity-50" />
            <input
              placeholder="Buscar quick reply..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList className="max-h-[400px] overflow-y-auto">
            {isLoading && quickReplies.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Carregando...
              </div>
            ) : quickReplies.length === 0 ? (
              <CommandEmpty>
                {search
                  ? 'Nenhuma resposta rápida encontrada.'
                  : 'Nenhuma resposta rápida cadastrada.'}
              </CommandEmpty>
            ) : (
              <>
                <CommandGroup>
                  {quickReplies.map((reply) => {
                  const isPopular = top3Ids.includes(reply.id);

                  return (
                    <Tooltip key={reply.id} delayDuration={600}>
                      <TooltipTrigger asChild>
                        <div
                          className="relative flex items-start gap-2 px-2 py-3 hover:bg-accent cursor-pointer group"
                          onClick={() => handleSelect(reply)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {reply.emoji && (
                                <span className="text-lg">{reply.emoji}</span>
                              )}
                              <span className="font-medium text-sm truncate">
                                {reply.title}
                              </span>
                              {isPopular && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  Popular
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {reply.content}
                            </p>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Usado {reply.usage_count}x
                            </div>
                          </div>

                          {/* Menu ellipsis */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditDialog(reply);
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDeleteDialog(reply);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TooltipTrigger>
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
                    </Tooltip>
                  );
                  })}
                </CommandGroup>

                {/* Footer com contador e botão carregar mais */}
                <div className="border-t px-3 py-2 bg-muted/30">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>
                      Mostrando {quickReplies.length} de {total}
                    </span>
                  </div>

                  {hasMore && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadMore();
                      }}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        <>Carregar mais ({total - quickReplies.length} restantes)</>
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>

    {/* Dialog de criar/editar quick reply */}
    <QuickReplyDialog
      open={dialogOpen}
      onOpenChange={handleCloseDialog}
      quickReply={editingReply}
      tenantId={tenantId}
      onSuccess={handleSuccess}
    />

    {/* Dialog de confirmação de exclusão */}
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a quick reply &quot;{deletingReply?.title}&quot;?
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteQuickReply.isLoading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteQuickReply.isLoading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleteQuickReply.isLoading ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
