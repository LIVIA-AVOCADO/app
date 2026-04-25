'use client';

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import type { AvailabilityStatus } from './availability-status-indicator';

interface AvailabilityDialogProps {
  onStatusSet: (status: AvailabilityStatus) => void;
}

export function AvailabilityDialog({ onStatusSet }: AvailabilityDialogProps) {
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  const handleGoOnline = () => {
    startTransition(async () => {
      await fetch('/api/users/me/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'online' }),
      });
      onStatusSet('online');
      setOpen(false);
    });
  };

  const handleNotYet = () => {
    onStatusSet('offline');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Você está pronto para atender?</DialogTitle>
          <DialogDescription className="pt-1 text-sm leading-relaxed">
            Ao ficar disponível, novas conversas poderão ser atribuídas a você
            automaticamente pelo sistema de roteamento.
            <br /><br />
            Se precisar de um momento para revisar suas pendências ou se organizar
            antes de começar o atendimento, fique à vontade — você pode ativar
            sua disponibilidade a qualquer momento pela barra lateral.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleNotYet}
            disabled={isPending}
          >
            Ainda não, obrigado
          </Button>
          <Button
            onClick={handleGoOnline}
            disabled={isPending}
          >
            {isPending ? 'Atualizando...' : 'Ficar disponível agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
