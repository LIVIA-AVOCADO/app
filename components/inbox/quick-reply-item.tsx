'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { QuickReply } from '@/types/livechat';
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

interface QuickReplyItemProps {
  quickReply: QuickReply;
  onEdit: (quickReply: QuickReply) => void;
  onDelete: () => void;
  onSelect: (content: string) => void;
  isPopular?: boolean;
  disabled?: boolean;
}

export function QuickReplyItem({
  quickReply,
  onEdit,
  onDelete,
  onSelect,
  isPopular = false,
  disabled = false,
}: QuickReplyItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/quick-replies/${quickReply.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar quick reply');
      }

      toast.success('Quick reply deletada com sucesso!');
      onDelete();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting quick reply:', error);
      toast.error('Erro ao deletar quick reply');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        className="flex items-start gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
        onClick={() => !disabled && onSelect(quickReply.content)}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            onSelect(quickReply.content);
          }
        }}
      >
        <div className="flex-1 min-w-0 cursor-pointer">
          <div className="flex items-center gap-2 mb-1">
            {quickReply.emoji && (
              <span className="text-lg">{quickReply.emoji}</span>
            )}
            <span className="font-medium text-sm truncate">
              {quickReply.title}
            </span>
            {isPopular && (
              <Badge variant="secondary" className="text-xs">
                Popular
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {quickReply.content}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Usado {quickReply.usage_count}x</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={disabled}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit(quickReply);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a quick reply &quot;{quickReply.title}&quot;?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
