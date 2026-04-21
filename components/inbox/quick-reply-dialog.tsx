'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { QuickReply } from '@/types/livechat';
import { useApiCall } from '@/lib/hooks';

interface QuickReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickReply?: QuickReply | null; // null = criar nova, objeto = editar
  tenantId: string;
  onSuccess: () => void;
}

export function QuickReplyDialog({
  open,
  onOpenChange,
  quickReply,
  tenantId,
  onSuccess,
}: QuickReplyDialogProps) {
  const [emoji, setEmoji] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const isEditing = !!quickReply;

  // API calls hooks
  const createQuickReply = useApiCall('/api/quick-replies', 'POST', {
    successMessage: 'Quick reply criada com sucesso!',
    errorMessage: 'Erro ao criar quick reply',
    onSuccess: () => {
      onSuccess();
      onOpenChange(false);
    },
  });

  const updateQuickReply = useApiCall(
    `/api/quick-replies/${quickReply?.id}`,
    'PATCH',
    {
      successMessage: 'Quick reply atualizada com sucesso!',
      errorMessage: 'Erro ao atualizar quick reply',
      onSuccess: () => {
        onSuccess();
        onOpenChange(false);
      },
    }
  );

  const isSubmitting = createQuickReply.isLoading || updateQuickReply.isLoading;

  // Preencher formulário ao editar
  useEffect(() => {
    if (quickReply) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setEmoji(quickReply.emoji || '');
      setTitle(quickReply.title);
      setContent(quickReply.content);
    } else {
      // Limpar formulário ao criar nova
      setEmoji('');
      setTitle('');
      setContent('');
    }
     
  }, [quickReply, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error('Título e Mensagem são obrigatórios');
      return;
    }

    const payload = {
      emoji: emoji.trim() || null,
      title: title.trim(),
      content: content.trim(),
      ...(isEditing ? {} : { tenantId }),
    };

    if (isEditing) {
      await updateQuickReply.execute(payload);
    } else {
      await createQuickReply.execute(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Quick Reply' : 'Nova Quick Reply'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Edite os campos abaixo e clique em Salvar.'
              : 'Preencha os campos abaixo. A quick reply nasce ativa e com 0 usos.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="emoji">Emoji (opcional)</Label>
              <Input
                id="emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="Ex: ⚡"
                maxLength={4}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">
                Título <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Saudação inicial"
                maxLength={100}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content">
                Mensagem <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ex: Olá! Como posso ajudar você hoje?"
                maxLength={1000}
                rows={6}
                required
                disabled={isSubmitting}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Você pode usar variáveis como {'{nome_cliente}'}, {'{protocolo}'}, etc.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar' : 'Inserir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
