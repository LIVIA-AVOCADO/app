'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { StepProps, KnowledgePayload } from '@/types/onboarding';

export function KnowledgeStep({ payload, onChange, disabled }: StepProps) {
  const data: KnowledgePayload = payload.knowledge ?? {};
  const [newInfo, setNewInfo] = useState('');

  function update(patch: Partial<KnowledgePayload>) {
    onChange('knowledge', { ...data, ...patch });
  }

  function addInfo() {
    const trimmed = newInfo.trim();
    if (!trimmed) return;
    update({ extra_information: [...(data.extra_information ?? []), trimmed] });
    setNewInfo('');
  }

  function removeInfo(index: number) {
    update({
      extra_information: (data.extra_information ?? []).filter((_, i) => i !== index),
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Nome da base de conhecimento *
          </label>
          <Input
            placeholder="Ex: Base Lab Vida"
            value={data.name ?? ''}
            onChange={(e) => update({ name: e.target.value })}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Descrição
          </label>
          <Textarea
            placeholder="Descreva o propósito desta base de conhecimento..."
            rows={3}
            value={data.description ?? ''}
            onChange={(e) => update({ description: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Informações adicionais
        </label>

        <div className="flex gap-2">
          <Input
            placeholder="Ex: Resultados podem ser acessados online."
            value={newInfo}
            onChange={(e) => setNewInfo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInfo())}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addInfo}
            disabled={disabled || !newInfo.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {(data.extra_information ?? []).length > 0 && (
          <ul className="space-y-2">
            {(data.extra_information ?? []).map((info, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <span className="flex-1 text-zinc-700 dark:text-zinc-300">{info}</span>
                <button
                  type="button"
                  onClick={() => removeInfo(i)}
                  disabled={disabled}
                  className="mt-0.5 text-zinc-400 hover:text-red-500 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {(data.extra_information ?? []).length === 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Nenhuma informação adicional. O FAQ e Catálogo serão a principal fonte de conhecimento.
          </p>
        )}
      </div>
    </div>
  );
}
