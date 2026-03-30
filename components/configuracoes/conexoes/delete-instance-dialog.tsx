'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeleteInstanceDialogProps {
  open:         boolean;
  channelId:    string;
  channelName:  string;
  providerType?: 'evolution' | 'meta' | 'unknown';
  onDeleted:    () => void;
  onCancel:     () => void;
}

export function DeleteInstanceDialog({
  open,
  channelId,
  channelName,
  providerType = 'evolution',
  onDeleted,
  onCancel,
}: DeleteInstanceDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const isMatch = confirmation === channelName;

  async function handleDelete() {
    if (!isMatch) return;
    setLoading(true);
    setError(null);

    try {
      const endpoint = providerType === 'meta'
        ? '/api/configuracoes/conexoes/meta/delete'
        : '/api/configuracoes/conexoes/delete';

      const res  = await fetch(endpoint, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ channelId }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erro ao deletar');
      onDeleted();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open && !loading) {
      setConfirmation('');
      setError(null);
      onCancel();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600 dark:text-red-400">
            Deletar instância
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-1">
            <span className="block">
              Esta ação é <strong>irreversível</strong>. O canal será desativado permanentemente.
              {providerType !== 'meta' && ' A instância também será removida da Evolution API.'}
            </span>
            <span className="block text-zinc-500">
              O histórico de conversas será preservado mas o canal não poderá mais
              enviar ou receber mensagens.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="confirm-name">
            Digite <strong className="text-zinc-900 dark:text-zinc-100">{channelName}</strong> para confirmar:
          </Label>
          <Input
            id="confirm-name"
            placeholder={channelName}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && isMatch) handleDelete(); }}
            autoFocus
            disabled={loading}
          />
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isMatch || loading}
          >
            {loading ? 'Deletando...' : 'Deletar instância'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
