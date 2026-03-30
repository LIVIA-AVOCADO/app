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

interface DisconnectConfirmDialogProps {
  open:        boolean;
  phoneNumber: string;
  loading:     boolean;
  onConfirm:   () => void;
  onCancel:    () => void;
}

export function DisconnectConfirmDialog({
  open,
  phoneNumber,
  loading,
  onConfirm,
  onCancel,
}: DisconnectConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desconectar número?</AlertDialogTitle>
          <AlertDialogDescription>
            O número <strong>{phoneNumber || 'atual'}</strong> será desvinculado desta instância.
            Você poderá reconectar outro número em seguida.
            <br /><br />
            <span className="text-yellow-600 dark:text-yellow-400 font-medium">
              Atenção: mensagens não serão recebidas ou enviadas enquanto a instância
              estiver desconectada.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {loading ? 'Desconectando...' : 'Desconectar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
