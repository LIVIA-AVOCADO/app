'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';
import { QuickReplyDialog } from './quick-reply-dialog';
import { QuickReplyItem } from './quick-reply-item';
import { toast } from 'sonner';
import type { QuickReply } from '@/types/livechat';

interface QuickRepliesManagerProps {
  tenantId: string;
  onSelect?: (content: string) => void;
}

export function QuickRepliesManager({
  tenantId,
  onSelect,
}: QuickRepliesManagerProps) {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);

  const loadQuickReplies = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/quick-replies?tenantId=${tenantId}`);
      if (!response.ok) throw new Error('Erro ao carregar quick replies');

      const data = await response.json();
      setQuickReplies(data.data || data.quickReplies || []);
    } catch (error) {
      console.error('Erro ao carregar quick replies:', error);
      toast.error('Erro ao carregar quick replies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuickReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleOpenDialog = (quickReply?: QuickReply) => {
    setEditingReply(quickReply || null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingReply(null);
  };

  const handleSuccess = () => {
    loadQuickReplies();
  };

  const handleDelete = () => {
    loadQuickReplies();
  };

  const handleSelect = (content: string) => {
    if (onSelect) {
      onSelect(content);
    }
  };

  // Top 3 mais usadas para marcar como "Popular"
  const sortedByUsage = [...quickReplies].sort(
    (a, b) => b.usage_count - a.usage_count
  );
  const popularIds = sortedByUsage.slice(0, 3).map((r) => r.id);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Quick Replies</h2>
        <Button
          onClick={() => handleOpenDialog()}
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : quickReplies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma quick reply cadastrada.</p>
              <p className="text-sm mt-2">
                Clique em &quot;Nova&quot; para criar sua primeira mensagem rápida.
              </p>
            </div>
          ) : (
            quickReplies.map((quickReply) => (
              <QuickReplyItem
                key={quickReply.id}
                quickReply={quickReply}
                onEdit={(qr) => handleOpenDialog(qr)}
                onDelete={handleDelete}
                onSelect={handleSelect}
                isPopular={popularIds.includes(quickReply.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <QuickReplyDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        quickReply={editingReply}
        tenantId={tenantId}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
