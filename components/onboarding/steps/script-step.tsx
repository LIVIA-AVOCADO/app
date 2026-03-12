'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, X, GripVertical } from 'lucide-react';
import type { StepProps, ScriptPayload, ScriptStep } from '@/types/onboarding';

export function ScriptStep({ payload, onChange, disabled }: StepProps) {
  const data: ScriptPayload = payload.script ?? {};
  const steps = data.steps ?? [];

  function update(newSteps: ScriptStep[]) {
    onChange('script', { ...data, steps: newSteps.map((s, i) => ({ ...s, order: i + 1 })) });
  }

  function addStep() {
    update([...steps, { order: steps.length + 1, name: '', instruction: '' }]);
  }

  function updateStep(index: number, patch: Partial<ScriptStep>) {
    update(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeStep(index: number) {
    update(steps.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 text-sm text-blue-700 dark:text-blue-300">
        <p className="font-medium mb-1">O que é o roteiro?</p>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          Define as etapas sequenciais que o agente deve seguir durante uma conversa.
          Cada etapa tem um nome e uma instrução de como o agente deve agir naquele momento.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {steps.length === 0 ? 'Nenhuma etapa adicionada' : `${steps.length} etapa(s)`}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addStep} disabled={disabled}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar etapa
        </Button>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-zinc-300" />
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Etapa {i + 1}
                </span>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(i)} disabled={disabled}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome da etapa *</label>
                <Input
                  placeholder="Ex: Saudação inicial, Coleta de informações, Encerramento"
                  value={step.name}
                  onChange={(e) => updateStep(i, { name: e.target.value })}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Instrução para o agente *</label>
                <Textarea
                  placeholder="Ex: Cumprimente o cliente pelo nome se disponível, apresente-se como Lívia e pergunte como pode ajudar..."
                  value={step.instruction}
                  onChange={(e) => updateStep(i, { instruction: e.target.value })}
                  disabled={disabled}
                  rows={3}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
