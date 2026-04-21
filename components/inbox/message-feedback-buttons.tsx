'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useApiCall } from '@/lib/hooks';

interface MessageFeedbackButtonsProps {
  messageId: string;
  conversationId: string;
  tenantId: string;
}

export function MessageFeedbackButtons({
  messageId,
  conversationId,
  tenantId,
}: MessageFeedbackButtonsProps) {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingRating, setPendingRating] = useState<'positive' | 'negative' | null>(null);
  const [comment, setComment] = useState('');

  // Estados para o dialog de confirmação de remoção
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removingType, setRemovingType] = useState<'positive' | 'negative' | null>(null);

  // API calls hooks
  const submitFeedback = useApiCall('/api/feedback/message', 'POST', {
    successMessage: '',  // Will be set dynamically
    errorMessage: 'Erro ao enviar feedback. Tente novamente.',
    onSuccess: () => {
      if (pendingRating) {
        setRating(pendingRating);
        toast.success(
          pendingRating === 'positive'
            ? 'Obrigado pelo feedback positivo!'
            : 'Obrigado pelo feedback! Vamos melhorar.'
        );
      }
      setDialogOpen(false);
      setPendingRating(null);
      setComment('');
    },
  });

  const handleButtonClick = (newRating: 'positive' | 'negative') => {
    // Se clicar no mesmo botão, pede confirmação para remover
    if (rating === newRating) {
      setRemovingType(newRating);
      setRemoveDialogOpen(true);
      return;
    }

    // Abre o dialog para adicionar comentário opcional
    setPendingRating(newRating);
    setComment('');
    setDialogOpen(true);
  };

  const handleConfirmRemove = () => {
    setRating(null);
    setRemoveDialogOpen(false);
    toast.info(
      removingType === 'positive'
        ? 'Feedback positivo removido'
        : 'Feedback negativo removido'
    );
    setRemovingType(null);
  };

  const handleSubmitFeedback = async () => {
    if (!pendingRating) return;

    await submitFeedback.execute({
      messageId,
      conversationId,
      rating: pendingRating,
      comment: comment.trim() || undefined,
      tenantId,
    });
  };

  return (
    <>
      <div className="flex items-center gap-1 mt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleButtonClick('positive')}
          disabled={submitFeedback.isLoading}
          className={cn(
            'h-7 w-7 p-0',
            rating === 'positive' && 'bg-green-500/20 text-green-600 hover:bg-green-500/30'
          )}
          title="Feedback positivo"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleButtonClick('negative')}
          disabled={submitFeedback.isLoading}
          className={cn(
            'h-7 w-7 p-0',
            rating === 'negative' && 'bg-red-500/20 text-red-600 hover:bg-red-500/30'
          )}
          title="Feedback negativo"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Feedback {pendingRating === 'positive' ? 'Positivo' : 'Negativo'}
            </DialogTitle>
            <DialogDescription>
              Adicione um comentário opcional para ajudar a melhorar o atendimento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Comentário (opcional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500 caracteres
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitFeedback.isLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmitFeedback} disabled={submitFeedback.isLoading}>
              {submitFeedback.isLoading ? 'Enviando...' : 'Enviar Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação para remover feedback */}
      <AlertDialog
        open={removeDialogOpen}
        onOpenChange={(open) => {
          setRemoveDialogOpen(open);
          if (!open) setRemovingType(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover feedback {removingType === 'positive' ? 'positivo' : 'negativo'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o feedback {removingType === 'positive' ? 'positivo' : 'negativo'} desta mensagem?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemove}>
              Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
