'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pause, MessageSquare, FileText, Loader2 } from 'lucide-react';
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
  allTags: Tag[]; // Todas as tags do tenant
  conversationTags?: Array<{ tag: Tag }>; // Tags atuais da conversa
  onConversationUpdate?: (updates: Partial<ConversationWithContact>) => void;
}

export function ConversationHeader({
  contactName,
  contactPhone,
  conversation,
  tenantId,
  allTags,
  conversationTags = [],
  onConversationUpdate,
}: ConversationHeaderProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPauseIADialog, setShowPauseIADialog] = useState(false);

  // Usar função utilitária para obter nome de exibição com fallback
  const displayName = getContactFirstName(contactName, contactPhone || null);

  // Extrair tags atuais (todas as tags da conversa)
  // Filtrar tags nulas (podem ocorrer quando tag foi deletada mas referência ainda existe)
  const selectedTags = useMemo(() => {
    return conversationTags
      .map(ct => ct.tag)
      .filter((tag): tag is Tag => tag !== null && tag !== undefined);
  }, [conversationTags]);

  const handlePauseIAClick = () => {
    setShowPauseIADialog(true);
  };

  const handlePauseIAConfirm = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/conversations/pause-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          tenantId: tenantId,
          reason: 'Pausado pelo atendente via Livechat - Modo manual permanente',
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao pausar IA');
      }

      toast.success('IA pausada - Modo manual permanente');
      // Atualiza o painel de conversas imediatamente (sem esperar realtime)
      onConversationUpdate?.({ ia_active: false });
    } catch (error) {
      console.error('Erro ao pausar IA:', error);
      toast.error('Erro ao pausar IA. Tente novamente.');
    } finally {
      setIsUpdating(false);
    }
  };


  const iaDisabled = conversation.status === 'closed';
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  return (
    <div className="p-4 border-b">
      {/* Linha 1: Nome do contato + Botões de Ação */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">{displayName}</h2>

        <div className="flex  gap-2 items-end">
        <Button
            onClick={() => setIsSummaryOpen(true)}
            variant="secondary"
            size="sm"
            className="text-xs h-7"
          >
            <FileText className="h-3 w-3 mr-2" />
            Resumo da conversa
          </Button>
          <Button
            onClick={handlePauseIAClick}
            disabled={!conversation.ia_active || isUpdating || iaDisabled}
            variant="outline"
            size="sm"
            className="transition-all duration-200 min-w-[110px]"
            title={
              !conversation.ia_active
                ? "IA pausada. Não pode ser retomada durante a conversa (perda de contexto)."
                : iaDisabled
                ? "Não é possível pausar IA em conversa encerrada"
                : "Pausar IA - Atendimento passará para modo manual permanente"
            }
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Pausando...
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pausar IA
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Linha 2: Tags */}
      {allTags.length > 0 && (
        <div className="mt-3">
          <TagSelector
            mode="assign"
            selectedTags={selectedTags}
            availableTags={allTags}
            onTagToggle={() => {}} // No-op: handled internally by mode="assign"
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
            <Badge variant="success">
              IA Ativada
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Modo Manual
            </Badge>
          )}
        </div>
      </div>

      <ConversationSummaryModal
        contactId={conversation.contact_id}
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
