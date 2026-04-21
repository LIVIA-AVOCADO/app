'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, Loader2, MessageSquare, User } from 'lucide-react';
import { toast } from 'sonner';
import { getContactDisplayName } from '@/lib/utils/contact-helpers';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MutedContact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  muted_at: string | null;
  mute_reason?: string | null;
  open_conversation_id?: string | null;
  mutedByUser: { id: string; full_name: string | null } | null;
}

interface MutedContactsListProps {
  tenantId: string;
  /** Abre o painel de mensagens (mesmo com contato silenciado) */
  onOpenConversation?: (conversationId: string) => void;
  /** Mantém a lista principal alinhada ao banco após remover silêncio */
  onPatchAfterUnmute?: (contactId: string) => void;
}

export function MutedContactsList({
  tenantId,
  onOpenConversation,
  onPatchAfterUnmute,
}: MutedContactsListProps) {
  const [contacts, setContacts] = useState<MutedContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unmutingId, setUnmutingId] = useState<string | null>(null);

  const fetchMuted = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/contacts/muted?tenantId=${tenantId}`);
      if (!res.ok) throw new Error('Erro ao carregar silenciados');
      const data = await res.json();
      setContacts(data.contacts ?? []);
    } catch {
      toast.error('Erro ao carregar contatos silenciados');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchMuted();
  }, [fetchMuted]);

  const handleUnmute = async (contactId: string) => {
    setUnmutingId(contactId);
    try {
      const res = await fetch(`/api/contacts/${contactId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unmute', tenantId }),
      });
      if (!res.ok) throw new Error('Erro ao remover silêncio');
      onPatchAfterUnmute?.(contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      toast.success('Silêncio removido. O contato voltará a receber mensagens.');
    } catch {
      toast.error('Erro ao remover silêncio. Tente novamente.');
    } finally {
      setUnmutingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Carregando...</span>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4 text-muted-foreground">
        <Bell className="h-8 w-8 mb-3 opacity-40" />
        <p className="text-sm font-medium">Nenhum contato silenciado</p>
        <p className="text-xs mt-1 opacity-70">
          Use o menu de ações em uma conversa para silenciar um contato
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {contacts.map((contact) => {
        const displayName = getContactDisplayName(contact.name, contact.phone);
        const mutedAgo = contact.muted_at
          ? formatDistanceToNow(new Date(contact.muted_at), { addSuffix: true, locale: ptBR })
          : null;

        const convId = contact.open_conversation_id ?? null;
        const canOpen = Boolean(convId && onOpenConversation);

        const openChat = () => {
          if (!convId || !onOpenConversation) {
            toast.error('Nenhuma conversa encontrada para abrir com este contato.');
            return;
          }
          onOpenConversation(convId);
        };

        return (
          <div
            key={contact.id}
            role={canOpen ? 'button' : undefined}
            tabIndex={canOpen ? 0 : undefined}
            onClick={canOpen ? openChat : undefined}
            onKeyDown={
              canOpen
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openChat();
                    }
                  }
                : undefined
            }
            className={`flex items-start gap-3 p-3 rounded-lg border bg-card transition-colors ${
              canOpen
                ? 'cursor-pointer hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                : 'opacity-90'
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{displayName}</p>
                {canOpen && (
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </div>
              {contact.phone && contact.name && (
                <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {contact.mutedByUser?.full_name
                  ? `Silenciado por ${contact.mutedByUser.full_name}`
                  : 'Silenciado'}
                {mutedAgo ? ` • ${mutedAgo}` : ''}
              </p>
              {contact.mute_reason ? (
                <p className="text-xs text-muted-foreground/90 mt-1 line-clamp-2 border-l-2 border-border pl-2">
                  {contact.mute_reason}
                </p>
              ) : null}
              {!canOpen && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Sem conversa associada — não é possível abrir o histórico por aqui.
                </p>
              )}
            </div>

            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => handleUnmute(contact.id)}
                disabled={unmutingId === contact.id}
              >
                {unmutingId === contact.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Bell className="h-3.5 w-3.5 mr-1" />
                )}
                Remover
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
