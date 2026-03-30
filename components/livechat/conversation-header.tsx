'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Pause, MessageSquare, FileText, Loader2, MoreVertical, User, BellOff, Bell, AlarmClock, AlarmClockOff } from 'lucide-react';
import { toast } from 'sonner';
import type { Conversation, Tag } from '@/types/database-helpers';
import type { ConversationFollowup, ConversationWithContact } from '@/types/livechat';
import { getContactFirstName } from '@/lib/utils/contact-helpers';
import { ConversationSummaryModal } from './conversation-summary-modal';
import { PauseIAConfirmDialog } from './pause-ia-confirm-dialog';
import { FollowUpDialog } from './follow-up-dialog';
import { TagSelector } from '@/components/tags/tag-selector';
import { StatusSelect } from './status-select';

interface ConversationHeaderProps {
  contactId: string;
  contactName: string;
  contactPhone?: string | null;
  contactIsMuted?: boolean;
  conversation: Conversation;
  tenantId: string;
  allTags: Tag[];
  conversationTags?: Array<{ tag: Tag }>;
  initialFollowup?: ConversationFollowup | null;
  onConversationUpdate?: (updates: Partial<ConversationWithContact>) => void;
  /** Callback chamado após silenciar o contato com sucesso */
  onContactMuted?: () => void;
  /** Callback chamado após remover o silêncio do contato */
  onContactUnmuted?: () => void;
  /** Callback para abrir/fechar o painel de dados do cliente */
  onTogglePanel?: () => void;
  /** Se o painel de dados está visível (sheet aberto ou coluna fixa) */
  isPanelActive?: boolean;
}

export function ConversationHeader({
  contactId,
  contactName,
  contactPhone,
  contactIsMuted = false,
  conversation,
  tenantId,
  allTags,
  conversationTags = [],
  initialFollowup = null,
  onConversationUpdate,
  onContactMuted,
  onContactUnmuted,
  onTogglePanel,
  isPanelActive = false,
}: ConversationHeaderProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMuting, setIsMuting] = useState(false);
  const [showPauseIADialog, setShowPauseIADialog] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [showMuteDialog, setShowMuteDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [activeFollowup, setActiveFollowup] = useState<ConversationFollowup | null>(initialFollowup);
  const [isCancellingFollowup, setIsCancellingFollowup] = useState(false);

  // Estado local do mute para refletir imediatamente após a ação
  const [isMuted, setIsMuted] = useState(contactIsMuted);

  const displayName = getContactFirstName(contactName, contactPhone || null);

  const selectedTags = useMemo(() => {
    return conversationTags
      .map((ct) => ct.tag)
      .filter((tag): tag is Tag => tag !== null && tag !== undefined);
  }, [conversationTags]);

  const handlePauseIAConfirm = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const response = await fetch('/api/conversations/pause-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          tenantId,
          reason: 'Pausado pelo atendente via Livechat - Modo manual permanente',
        }),
      });
      if (!response.ok) throw new Error('Erro ao pausar IA');
      toast.success('IA pausada - Modo manual permanente');
      onConversationUpdate?.({ ia_active: false });
    } catch (error) {
      console.error('Erro ao pausar IA:', error);
      toast.error('Erro ao pausar IA. Tente novamente.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMuteConfirm = async () => {
    if (isMuting) return;
    setIsMuting(true);
    try {
      const response = await fetch(`/api/contacts/${contactId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mute', tenantId }),
      });
      if (!response.ok) throw new Error('Erro ao silenciar contato');
      setIsMuted(true);
      toast.success('Contato silenciado. As mensagens serão descartadas automaticamente.');
      onContactMuted?.();
    } catch (error) {
      console.error('Erro ao silenciar contato:', error);
      toast.error('Erro ao silenciar contato. Tente novamente.');
    } finally {
      setIsMuting(false);
    }
  };

  const handleUnmute = async () => {
    if (isMuting) return;
    setIsMuting(true);
    try {
      const response = await fetch(`/api/contacts/${contactId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unmute', tenantId }),
      });
      if (!response.ok) throw new Error('Erro ao remover silêncio');
      setIsMuted(false);
      toast.success('Silêncio removido. O contato voltará a receber mensagens.');
      onContactUnmuted?.();
    } catch (error) {
      console.error('Erro ao remover silêncio:', error);
      toast.error('Erro ao remover silêncio. Tente novamente.');
    } finally {
      setIsMuting(false);
    }
  };

  const handleCancelFollowup = async () => {
    if (!activeFollowup || isCancellingFollowup) return;
    setIsCancellingFollowup(true);
    try {
      const response = await fetch(`/api/conversations/followup/${activeFollowup.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Erro ao cancelar follow-up');
      setActiveFollowup(null);
      toast.success('Follow up cancelado');
    } catch (error) {
      console.error('Erro ao cancelar follow-up:', error);
      toast.error('Erro ao cancelar follow-up. Tente novamente.');
    } finally {
      setIsCancellingFollowup(false);
    }
  };

  const iaDisabled = conversation.status === 'closed';

  return (
    <div className="p-3 border-b">
      {/* Linha 1: Nome + canal (esquerda) | Status + IA + ações (direita) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Esquerda: nome + canal */}
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-lg font-semibold truncate">{displayName}</h2>
          {isMuted && (
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="bottom">Contato silenciado</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex items-center gap-1 text-muted-foreground shrink-0">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="text-xs">WhatsApp</span>
          </div>
        </div>

        {/* Direita: status + badge IA + botões */}
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusSelect
            conversationId={conversation.id}
            tenantId={tenantId}
            currentStatus={conversation.status}
            onStatusChange={(newStatus) => onConversationUpdate?.({ status: newStatus })}
          />

          {conversation.ia_active ? (
            <Badge variant="success" className="text-xs">IA</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Manual</Badge>
          )}

          {activeFollowup && (
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs gap-1 text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/30 cursor-default">
                    <AlarmClock className="h-3 w-3" />
                    Follow Up
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Agendado para {new Date(activeFollowup.scheduled_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                  })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Botão de dados do cliente */}
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isPanelActive ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={onTogglePanel}
                  aria-label="Dados do cliente"
                >
                  <User className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isPanelActive ? 'Fechar dados do cliente' : 'Dados do cliente'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Menu de ações secundárias */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Mais ações"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setIsSummaryOpen(true)}>
                <FileText className="h-4 w-4 mr-2" />
                Resumo da conversa
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {activeFollowup ? (
                <DropdownMenuItem
                  onClick={handleCancelFollowup}
                  disabled={isCancellingFollowup || conversation.status === 'closed'}
                  className="text-orange-600 focus:text-orange-600"
                >
                  {isCancellingFollowup ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <AlarmClockOff className="h-4 w-4 mr-2" />
                  )}
                  Cancelar Follow Up
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => setShowFollowUpDialog(true)}
                  disabled={conversation.status === 'closed'}
                >
                  <AlarmClock className="h-4 w-4 mr-2" />
                  Ativar Follow Up
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setShowPauseIADialog(true)}
                disabled={!conversation.ia_active || isUpdating || iaDisabled}
                className="text-orange-600 focus:text-orange-600"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4 mr-2" />
                )}
                {conversation.ia_active ? 'Pausar IA' : 'IA já pausada'}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={isMuted ? handleUnmute : () => setShowMuteDialog(true)}
                disabled={isMuting}
                className={isMuted
                  ? 'text-green-600 focus:text-green-600'
                  : 'text-destructive focus:text-destructive'
                }
              >
                {isMuting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isMuted ? (
                  <Bell className="h-4 w-4 mr-2" />
                ) : (
                  <BellOff className="h-4 w-4 mr-2" />
                )}
                {isMuted ? 'Remover silêncio' : 'Silenciar contato'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Linha 2: Tags */}
      {allTags.length > 0 && (
        <div className="mt-3">
          <TagSelector
            mode="assign"
            selectedTags={selectedTags}
            availableTags={allTags}
            onTagToggle={() => {}}
            conversationId={conversation.id}
            tenantId={tenantId}
            placeholder="Adicionar tags"
          />
        </div>
      )}

      <ConversationSummaryModal
        contactId={conversation.contact_id}
        conversationId={conversation.id}
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
      />

      <PauseIAConfirmDialog
        open={showPauseIADialog}
        onOpenChange={setShowPauseIADialog}
        onConfirm={handlePauseIAConfirm}
        trigger="manual"
      />

      <FollowUpDialog
        open={showFollowUpDialog}
        onOpenChange={setShowFollowUpDialog}
        conversationId={conversation.id}
        tenantId={tenantId}
        onCreated={(followup) => {
          setActiveFollowup(followup);
          onConversationUpdate?.({ ia_active: false });
        }}
      />

      {/* Dialog de confirmação para silenciar */}
      <AlertDialog open={showMuteDialog} onOpenChange={setShowMuteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Silenciar {displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              As mensagens deste contato serão descartadas automaticamente. A IA também será pausada.
              <br /><br />
              Você pode desfazer essa ação na aba <strong>Silenciadas</strong> no painel de conversas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMuteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Silenciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
