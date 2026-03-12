'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { StepProps, ConversationRulesPayload } from '@/types/onboarding';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

const ACTION_OPTIONS = [
  { value: 'end_conversation', label: 'Encerrar conversa' },
  { value: 'transfer_human',   label: 'Transferir para humano' },
  { value: 'send_message',     label: 'Enviar mensagem' },
];

export function ConversationRulesStep({ payload, onChange, disabled }: StepProps) {
  const data: ConversationRulesPayload = payload.conversation_rules ?? {};
  const timeouts = data.timeouts ?? {};
  const reactivation = data.reactivation ?? {};

  function updateTimeouts(patch: Partial<typeof timeouts>) {
    onChange('conversation_rules', { ...data, timeouts: { ...timeouts, ...patch } });
  }

  function updateReactivation(patch: Partial<typeof reactivation>) {
    onChange('conversation_rules', { ...data, reactivation: { ...reactivation, ...patch } });
  }

  return (
    <div className="space-y-6">
      {/* Timeout de inatividade */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Timeout de Inatividade</p>
            <p className="text-xs text-zinc-500 mt-0.5">Ação ao detectar inatividade do cliente</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Ativo</span>
            <Switch
              checked={timeouts.is_active ?? true}
              onCheckedChange={(v) => updateTimeouts({ is_active: v })}
              disabled={disabled}
            />
          </div>
        </div>

        <Field label="Tempo de inatividade (minutos)" hint="Após quantos minutos sem resposta a conversa é encerrada">
          <Input
            type="number"
            min={1}
            max={1440}
            placeholder="30"
            value={timeouts.ia_inactive_timeout_minutes ?? ''}
            onChange={(e) => updateTimeouts({ ia_inactive_timeout_minutes: Number(e.target.value) || undefined })}
            disabled={disabled}
            className="max-w-[160px]"
          />
        </Field>

        <Field label="Mensagem de encerramento">
          <Textarea
            placeholder="Ex: Conversa encerrada por inatividade. Entre em contato novamente quando precisar!"
            value={timeouts.closure_message ?? ''}
            onChange={(e) => updateTimeouts({ closure_message: e.target.value })}
            disabled={disabled}
            rows={2}
          />
        </Field>
      </div>

      <Separator />

      {/* Reativação */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Regras de Reativação</p>
          <p className="text-xs text-zinc-500 mt-0.5">Como o agente deve agir quando esgotar as tentativas de reativação</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ação ao esgotar tentativas">
            <Select
              value={reactivation.exhausted_action ?? ''}
              onValueChange={(v) => updateReactivation({ exhausted_action: v })}
              disabled={disabled}
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Janela máxima (minutos)" hint="Tempo total máximo de reativação">
            <Input
              type="number"
              min={1}
              placeholder="1440"
              value={reactivation.max_reactivation_window_minutes ?? ''}
              onChange={(e) => updateReactivation({ max_reactivation_window_minutes: Number(e.target.value) || undefined })}
              disabled={disabled}
            />
          </Field>
        </div>

        <Field label="Mensagem ao esgotar tentativas">
          <Textarea
            placeholder="Ex: Conversa encerrada devido inatividade."
            value={reactivation.exhausted_message ?? ''}
            onChange={(e) => updateReactivation({ exhausted_message: e.target.value })}
            disabled={disabled}
            rows={2}
          />
        </Field>

        <Field label="Ação ao atingir janela máxima">
          <Select
            value={reactivation.max_window_action ?? ''}
            onValueChange={(v) => updateReactivation({ max_window_action: v })}
            disabled={disabled}
          >
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Mensagem ao atingir janela máxima">
          <Textarea
            placeholder="Ex: Janela máxima atingida."
            value={reactivation.max_window_message ?? ''}
            onChange={(e) => updateReactivation({ max_window_message: e.target.value })}
            disabled={disabled}
            rows={2}
          />
        </Field>
      </div>
    </div>
  );
}
