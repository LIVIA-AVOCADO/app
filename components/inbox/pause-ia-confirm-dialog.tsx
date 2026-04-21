'use client';

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

interface PauseIAConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  trigger?: 'manual' | 'message_send';
}

export function PauseIAConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  trigger = 'manual',
}: PauseIAConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const getTitle = () => {
    if (trigger === 'message_send') {
      return '⚠️ Enviar mensagem irá pausar a IA';
    }
    return '⚠️ Pausar IA?';
  };

  const getDescription = () => {
    if (trigger === 'message_send') {
      return (
        <>
          Ao enviar uma mensagem manualmente, a <strong>IA será pausada automaticamente</strong> e não poderá ser retomada durante esta conversa devido a problemas de perda de contexto.
          <br />
          <br />
          O atendimento passará para <strong>modo manual permanente</strong> até encerrar a conversa.
          <br />
          <br />
          Deseja continuar e enviar a mensagem?
        </>
      );
    }

    return (
      <>
        A IA não poderá ser retomada durante esta conversa devido a problemas de perda de contexto.
        <br />
        <br />
        O atendimento passará para <strong>modo manual permanente</strong> até encerrar a conversa.
        <br />
        <br />
        Deseja continuar?
      </>
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            {getDescription()}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="bg-yellow-600 hover:bg-yellow-700">
            {trigger === 'message_send' ? 'Sim, enviar e pausar IA' : 'Sim, pausar IA'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
