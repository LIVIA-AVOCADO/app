'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { upsertConversationTimeoutAction } from '@/app/actions/conversation-timeout';
import { upsertConversationTimeoutSchema } from '@/lib/validations/conversation-timeout-validation';
import type { ConversationTimeoutSettings } from '@/lib/validations/conversation-timeout-validation';

const TIMEOUT_PRESETS = [
  { label: '30 min', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: '4 horas', value: 240 },
  { label: '8 horas', value: 480 },
  { label: '24 horas', value: 1440 },
] as const;

interface EncerramentoFormProps {
  tenantId: string;
  userId: string;
  initialSettings: ConversationTimeoutSettings | null;
}

export function EncerramentoForm({ tenantId, userId, initialSettings }: EncerramentoFormProps) {
  const initialMinutes = initialSettings?.ia_inactive_timeout_minutes ?? null;
  const isPreset = initialMinutes
    ? TIMEOUT_PRESETS.some((p) => p.value === initialMinutes)
    : false;

  const [isActive, setIsActive] = useState(initialSettings?.is_active ?? false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(
    isPreset ? initialMinutes : null
  );
  const [isCustom, setIsCustom] = useState(!isPreset && initialMinutes !== null);
  const [customValue, setCustomValue] = useState(
    !isPreset && initialMinutes ? String(initialMinutes) : ''
  );
  const [closureMessage, setClosureMessage] = useState(
    initialSettings?.closure_message ?? ''
  );
  const [isPending, startTransition] = useTransition();

  const resolvedMinutes: number | null = isCustom
    ? customValue ? parseInt(customValue, 10) : null
    : selectedPreset;

  function handlePresetClick(value: number) {
    setSelectedPreset(value);
    setIsCustom(false);
    setCustomValue('');
  }

  function handleCustomClick() {
    setSelectedPreset(null);
    setIsCustom(true);
  }

  function handleSubmit() {
    const payload = {
      is_active: isActive,
      ia_inactive_timeout_minutes: resolvedMinutes ?? undefined,
      closure_message: closureMessage.trim() || null,
    };

    const parsed = upsertConversationTimeoutSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }

    startTransition(async () => {
      const result = await upsertConversationTimeoutAction(userId, tenantId, parsed.data);
      if (result.success) {
        toast.success('Configurações salvas com sucesso');
      } else {
        toast.error(result.error ?? 'Erro ao salvar configurações');
      }
    });
  }

  const fieldsDisabled = !isActive || isPending;

  return (
    <div className="space-y-6">
      {/* Card 1 — Toggle principal */}
      <Card>
        <CardHeader>
          <CardTitle>Encerramento Automático</CardTitle>
          <CardDescription>
            Quando ativado, conversas sem resposta do cliente serão encerradas automaticamente
            após o tempo configurado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is-active" className="text-base">
                Ativar encerramento automático
              </Label>
              <p className="text-sm text-muted-foreground">
                {isActive ? 'Conversas inativas serão encerradas automaticamente' : 'Desativado — conversas não serão encerradas por inatividade'}
              </p>
            </div>
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 2 — Tempo de inatividade */}
      <Card className={fieldsDisabled ? 'opacity-60 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle>Tempo de Inatividade</CardTitle>
          <CardDescription>
            Após quantos minutos sem resposta do cliente a conversa será encerrada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TIMEOUT_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={selectedPreset === preset.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetClick(preset.value)}
                disabled={fieldsDisabled}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              type="button"
              variant={isCustom ? 'default' : 'outline'}
              size="sm"
              onClick={handleCustomClick}
              disabled={fieldsDisabled}
            >
              Personalizado
            </Button>
          </div>

          {isCustom && (
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                placeholder="Ex: 90"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                disabled={fieldsDisabled}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">minutos</span>
            </div>
          )}

          {resolvedMinutes && resolvedMinutes > 0 && (
            <p className="text-sm text-muted-foreground">
              Conversas serão encerradas após{' '}
              <span className="font-medium text-foreground">
                {resolvedMinutes >= 60
                  ? `${resolvedMinutes / 60 === Math.floor(resolvedMinutes / 60) ? resolvedMinutes / 60 : (resolvedMinutes / 60).toFixed(1)} hora${resolvedMinutes !== 60 ? 's' : ''}`
                  : `${resolvedMinutes} minutos`}
              </span>{' '}
              de inatividade.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Card 3 — Mensagem de encerramento */}
      <Card className={fieldsDisabled ? 'opacity-60 pointer-events-none' : ''}>
        <CardHeader>
          <CardTitle>Mensagem de Encerramento</CardTitle>
          <CardDescription>
            Mensagem enviada ao cliente quando a conversa for encerrada por inatividade.
            Deixe em branco para não enviar mensagem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            placeholder="Ex: Sua conversa foi encerrada por inatividade. Se precisar de ajuda, é só nos chamar novamente!"
            value={closureMessage}
            onChange={(e) => setClosureMessage(e.target.value)}
            disabled={fieldsDisabled}
            rows={4}
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground text-right">
            {closureMessage.length}/1000
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
