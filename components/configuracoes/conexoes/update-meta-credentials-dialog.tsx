'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

interface UpdateMetaCredentialsDialogProps {
  open:          boolean;
  channelId:     string;
  phoneNumberId: string;  // valor atual para pré-preencher
  onUpdated:     (phoneNumber?: string) => void;
  onClose:       () => void;
}

type Step = 'form' | 'loading' | 'connected' | 'error';

export function UpdateMetaCredentialsDialog({
  open,
  channelId,
  phoneNumberId: initialPhoneNumberId,
  onUpdated,
  onClose,
}: UpdateMetaCredentialsDialogProps) {
  const [step,         setStep]         = useState<Step>('form');
  const [phoneNumberId, setPhoneNumberId] = useState(initialPhoneNumberId);
  const [accessToken,  setAccessToken]  = useState('');
  const [showToken,    setShowToken]    = useState(false);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [phoneNumber,  setPhoneNumber]  = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep('form');
      setPhoneNumberId(initialPhoneNumberId);
      setAccessToken('');
      setErrorMsg(null);
      setPhoneNumber(null);
      setShowToken(false);
    }
  }, [open, initialPhoneNumberId]);

  const isFormValid = phoneNumberId.trim() && accessToken.trim();

  async function handleUpdate() {
    if (!isFormValid) return;
    setSubmitting(true);
    setStep('loading');
    setErrorMsg(null);

    try {
      const res  = await fetch('/api/configuracoes/conexoes/meta/update-credentials', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          channelId,
          phoneNumberId: phoneNumberId.trim(),
          accessToken:   accessToken.trim(),
        }),
      });

      const data = await res.json() as {
        phoneNumber?:      string;
        verifiedName?:     string;
        connectionStatus?: string;
        error?:            string;
      };

      if (!res.ok) throw new Error(data.error ?? 'Erro ao atualizar credenciais');

      setPhoneNumber(data.phoneNumber ?? null);
      setStep('connected');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep('error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone() {
    onUpdated(phoneNumber ?? undefined);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar credenciais Meta</DialogTitle>
          <DialogDescription>
            {step === 'form'      && 'Insira o novo access token para reconectar este canal.'}
            {step === 'loading'   && 'Verificando novas credenciais...'}
            {step === 'connected' && 'Credenciais atualizadas com sucesso!'}
            {step === 'error'     && 'Não foi possível verificar as credenciais.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {/* ── Step: form ── */}
          {step === 'form' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="update-phone-number-id">Phone Number ID</Label>
                <Input
                  id="update-phone-number-id"
                  placeholder="Ex: 123456789012345"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="update-access-token">Novo Access Token</Label>
                <div className="relative">
                  <Input
                    id="update-access-token"
                    type={showToken ? 'text' : 'password'}
                    placeholder="EAAA..."
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    tabIndex={-1}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
                <Button onClick={handleUpdate} disabled={!isFormValid || submitting}>
                  Atualizar
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: loading ── */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-500">Verificando na Meta...</p>
            </div>
          )}

          {/* ── Step: error ── */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <p className="text-sm text-red-500">{errorMsg}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Fechar</Button>
                <Button variant="outline" onClick={() => setStep('form')}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: connected ── */}
          {step === 'connected' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">Canal reconectado!</p>
                {phoneNumber && (
                  <p className="text-sm text-zinc-500 mt-1">{phoneNumber}</p>
                )}
              </div>
              <Button onClick={handleDone}>Concluir</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
