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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Pause, MessageSquare, FileText, Loader2, MoreVertical, User } from 'lucide-react';
import { toast } from 'sonner';
import type { Conversation, Tag } from '@/types/database-helpers';
import type { ConversationWithContact } from '@/types/livechat';
import { getContactFirstName } from '@/lib/utils/contact-helpers';
import { ConversationSummaryModal } from './conversation-summary-modal';
import { PauseIAConfirmDialog } from './pause-ia-confirm-dialog';
import { TagSelector } from '@/components/tags/tag-selector';
import { StatusSelect } from './status-select';

interface ConversationHeaderProps {
  contactName: string;
  contactPhone?: string | null;
  conversation: Conversation;
  tenantId: string;
  allTags: Tag[];
  conversationTags?: Array<{ tag: Tag }>;
  onConversationUpdate?: (updates: Partial<ConversationWithContact>) => void;
  /** Callback para abrir/fechar o painel de dados do cliente */
  onTogglePanel?: () => void;
  /** Se o painel de dados está visível (sheet aberto ou coluna fixa) */
  isPanelActive?: boolean;
}

export function ConversationHeader({
  contactName,
  contactPhone,
  conversation,
  tenantId,
  allTags,
  conversationTags = [],
  onConversationUpdate,
  onTogglePanel,
  isPanelActive = false,
}: ConversationHeaderProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPauseIADialog, setShowPauseIADialog] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

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

  const iaDisabled = conversation.status === 'closed';

  return (
    <div className="p-4 border-b">
      {/* Linha 1: Nome do contato + ações */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold truncate mr-2">{displayName}</h2>

        <div className="flex items-center gap-1 shrink-0">
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

      {/* Linha 3: Canal • Status • IA */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
        <div className="flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>WhatsApp</span>
        </div>

        <span>•</span>

        <StatusSelect
          conversationId={conversation.id}
          tenantId={tenantId}
          currentStatus={conversation.status}
          onStatusChange={(newStatus) => onConversationUpdate?.({ status: newStatus })}
        />

        <span>•</span>

        <div className="flex items-center gap-1.5">
          {conversation.ia_active ? (
            <Badge variant="success">IA Ativada</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Modo Manual
            </Badge>
          )}
        </div>
      </div>

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
    </div>
  );
}
