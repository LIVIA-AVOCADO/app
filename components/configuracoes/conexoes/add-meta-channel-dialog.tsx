'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';
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

interface AddMetaChannelDialogProps {
  open:    boolean;
  onClose: () => void;
}

// 'warning' = canal salvo mas credenciais não foram verificadas (erro de rede)
type Step = 'form' | 'loading' | 'connected' | 'warning' | 'error';

interface FormData {
  name:          string;
  phoneNumberId: string;
  accessToken:   string;
}

export function AddMetaChannelDialog({ open, onClose }: AddMetaChannelDialogProps) {
  const router = useRouter();

  const [step,         setStep]         = useState<Step>('form');
  const [form,         setForm]         = useState<FormData>({ name: '', phoneNumberId: '', accessToken: '' });
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [warningMsg,   setWarningMsg]   = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [showToken,    setShowToken]    = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [phoneNumber,  setPhoneNumber]  = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep('form');
      setForm({ name: '', phoneNumberId: '', accessToken: '' });
      setErrorMsg(null);
      setWarningMsg(null);
      setVerifiedName(null);
      setPhoneNumber(null);
      setShowToken(false);
    }
  }, [open]);

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const isFormValid = form.name.trim() && form.phoneNumberId.trim() && form.accessToken.trim();

  async function handleCreate() {
    if (!isFormValid) return;
    setSubmitting(true);
    setStep('loading');
    setErrorMsg(null);
    setWarningMsg(null);

    try {
      const res  = await fetch('/api/configuracoes/conexoes/meta/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:          form.name.trim(),
          phoneNumberId: form.phoneNumberId.trim(),
          accessToken:   form.accessToken.trim(),
        }),
      });

      const data = await res.json() as {
        channelId?:        string;
        phoneNumber?:      string;
        verifiedName?:     string;
        connectionStatus?: string;
        warning?:          string;
        error?:            string;
      };

      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar canal');

      setVerifiedName(data.verifiedName ?? null);
      setPhoneNumber(data.phoneNumber   ?? null);

      if (data.warning) {
        // Canal salvo mas verificação falhou por erro de rede
        setWarningMsg(data.warning);
        setStep('warning');
      } else {
        setStep('connected');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep('error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone() {
    onClose();
    router.refresh();
  }

  function handleClose() {
    onClose();
    // Faz refresh se canal foi salvo (connected ou warning)
    if (step === 'connected' || step === 'warning') router.refresh();
  }

  const stepDescription = {
    form:      'Insira as credenciais da sua conta Meta Business.',
    loading:   'Verificando credenciais...',
    connected: 'Canal conectado com sucesso!',
    warning:   'Canal salvo — verificação pendente.',
    error:     'Ocorreu um erro ao verificar as credenciais.',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar canal Meta WhatsApp</DialogTitle>
          <DialogDescription>{stepDescription[step]}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {/* ── Step: form ── */}
          {step === 'form' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="meta-channel-name">Nome do canal</Label>
                <Input
                  id="meta-channel-name"
                  placeholder="Ex: WhatsApp Atendimento"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meta-phone-number-id">Phone Number ID</Label>
                <Input
                  id="meta-phone-number-id"
                  placeholder="Ex: 123456789012345"
                  value={form.phoneNumberId}
                  onChange={(e) => handleChange('phoneNumberId', e.target.value)}
                />
                <p className="text-xs text-zinc-500">
                  Encontre em Meta for Developers → seu App → WhatsApp → API Setup.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meta-access-token">Access Token</Label>
                <div className="relative">
                  <Input
                    id="meta-access-token"
                    type={showToken ? 'text' : 'password'}
                    placeholder="EAAA..."
                    value={form.accessToken}
                    onChange={(e) => handleChange('accessToken', e.target.value)}
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
                <p className="text-xs text-zinc-500">
                  Use um System User Token permanente para evitar expiração.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={!isFormValid || submitting}>
                  Conectar canal
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: loading ── */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-500">Verificando credenciais na Meta...</p>
            </div>
          )}

          {/* ── Step: error — credencial rejeitada pela Meta ── */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <p className="text-sm text-red-500">{errorMsg}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Fechar</Button>
                <Button variant="outline" onClick={() => setStep('form')}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: warning — canal salvo mas verificação falhou por rede ── */}
          {step === 'warning' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <AlertTriangle className="h-7 w-7 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">Canal salvo!</p>
                <p className="text-sm text-zinc-500 max-w-xs">
                  {warningMsg}
                </p>
              </div>
              <Button onClick={handleDone}>Entendido</Button>
            </div>
          )}

          {/* ── Step: connected — tudo certo ── */}
          {step === 'connected' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">Canal conectado!</p>
                {verifiedName && (
                  <p className="text-sm text-zinc-500 mt-1">{verifiedName}</p>
                )}
                {phoneNumber && (
                  <p className="text-sm text-zinc-500">{phoneNumber}</p>
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
