'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { StepProps, ServicePayload } from '@/types/onboarding';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

const TONE_OPTIONS = [
  { value: 'formal',      label: 'Formal' },
  { value: 'semiformal',  label: 'Semiformal' },
  { value: 'informal',    label: 'Informal' },
  { value: 'tecnico',     label: 'Técnico' },
  { value: 'empático',    label: 'Empático' },
];

export function ServiceStep({ payload, onChange, disabled }: StepProps) {
  const data: ServicePayload = payload.service ?? {};

  function update(patch: Partial<ServicePayload>) {
    onChange('service', { ...data, ...patch });
  }

  function addForbiddenTopic() {
    update({ forbidden_topics: [...(data.forbidden_topics ?? []), ''] });
  }

  function updateTopic(index: number, value: string) {
    const topics = [...(data.forbidden_topics ?? [])];
    topics[index] = value;
    update({ forbidden_topics: topics });
  }

  function removeTopic(index: number) {
    update({ forbidden_topics: (data.forbidden_topics ?? []).filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-6">
      <Field label="Tom de voz" hint="Como o agente deve se comunicar com os clientes">
        <Select value={data.tone ?? ''} onValueChange={(v) => update({ tone: v })} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tom de voz" />
          </SelectTrigger>
          <SelectContent>
            {TONE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Estilo de atendimento" hint="Descreva como o agente deve conduzir o atendimento">
        <Input
          placeholder="Ex: Objetivo, direto, sempre oferecer alternativas quando não puder resolver"
          value={data.style ?? ''}
          onChange={(e) => update({ style: e.target.value })}
          disabled={disabled}
        />
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Tópicos proibidos
          </label>
          <Button type="button" variant="outline" size="sm" onClick={addForbiddenTopic} disabled={disabled}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </div>
        <p className="text-xs text-zinc-400">Assuntos que o agente não deve abordar</p>
        {(data.forbidden_topics ?? []).length === 0 && (
          <p className="text-xs text-zinc-400 italic">Nenhum tópico adicionado</p>
        )}
        <div className="space-y-2">
          {(data.forbidden_topics ?? []).map((topic, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Ex: Política, concorrentes, preços de terceiros"
                value={topic}
                onChange={(e) => updateTopic(i, e.target.value)}
                disabled={disabled}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeTopic(i)} disabled={disabled}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
