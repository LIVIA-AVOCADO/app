'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import type { ConversationFollowup } from '@/types/livechat';

const HOUR_OPTIONS = [
  { value: '1', label: '1 hora' },
  { value: '2', label: '2 horas' },
  { value: '4', label: '4 horas' },
  { value: '6', label: '6 horas' },
  { value: '12', label: '12 horas' },
  { value: '24', label: '24 horas' },
  { value: '48', label: '48 horas' },
  { value: '72', label: '72 horas' },
];

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  tenantId: string;
  onCreated: (followup: ConversationFollowup) => void;
}

export function FollowUpDialog({
  open,
  onOpenChange,
  conversationId,
  tenantId,
  onCreated,
}: FollowUpDialogProps) {
  const [hours, setHours] = useState('24');
  const [aiGenerate, setAiGenerate] = useState(false);
  const [message, setMessage] = useState('');
  const [cancelOnReply, setCancelOnReply] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (!aiGenerate && !message.trim()) {
      toast.error('Digite uma mensagem ou escolha geração pela IA');
      return;
    }

    setIsLoading(true);
    try {
      const scheduledAt = new Date(
        Date.now() + parseInt(hours) * 60 * 60 * 1000
      ).toISOString();

      const response = await fetch('/api/conversations/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          tenantId,
          scheduledAt,
          message: aiGenerate ? null : message.trim(),
          aiGenerate,
          cancelOnReply,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || 'Erro ao criar follow-up');
      }

      const { followup } = await response.json();
      toast.success(`Follow up agendado para ${parseInt(hours)}h`);
      onCreated(followup);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar follow-up');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setHours('24');
    setAiGenerate(false);
    setMessage('');
    setCancelOnReply(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Follow Up</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Tempo */}
          <div className="space-y-1.5">
            <Label>Enviar em</Label>
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de mensagem */}
          <div className="space-y-3">
            <Label>Mensagem</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAiGenerate(false)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  !aiGenerate
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-foreground/30'
                }`}
              >
                <PenLine className="h-4 w-4" />
                Escrever manualmente
              </button>
              <button
                type="button"
                onClick={() => setAiGenerate(true)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  aiGenerate
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-foreground/30'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                IA gera a mensagem
              </button>
            </div>

            {!aiGenerate && (
              <Textarea
                placeholder="Digite a mensagem de follow up..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[90px] resize-none"
                autoFocus
              />
            )}

            {aiGenerate && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                A IA vai gerar uma mensagem com base no contexto da conversa no momento do envio.
              </p>
            )}
          </div>

          {/* Cancelar se cliente responder */}
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Cancelar se cliente responder</p>
              <p className="text-xs text-muted-foreground">
                Se o cliente mandar mensagem antes do follow up, ele será cancelado automaticamente
              </p>
            </div>
            <Switch checked={cancelOnReply} onCheckedChange={setCancelOnReply} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Ativar Follow Up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
