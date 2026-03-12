'use client';

import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { StepProps, FaqPayload, FaqItem } from '@/types/onboarding';

export function FaqStep({ payload, onChange, disabled }: StepProps) {
  const data: FaqPayload = payload.faq ?? {};
  const items = data.items ?? [];

  function update(newItems: FaqItem[]) {
    onChange('faq', { ...data, items: newItems });
  }

  function addItem() {
    update([...items, { question: '', answer: '' }]);
  }

  function updateItem(index: number, patch: Partial<FaqItem>) {
    update(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    update(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {items.length === 0 ? 'Nenhuma pergunta adicionada' : `${items.length} pergunta(s)`}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={disabled}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar pergunta
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Pergunta {i + 1}
              </span>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={disabled}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Pergunta *</label>
                <Input
                  placeholder="Ex: Preciso de preparo para o exame de sangue?"
                  value={item.question}
                  onChange={(e) => updateItem(i, { question: e.target.value })}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Resposta *</label>
                <Textarea
                  placeholder="Ex: Para exames de sangue em jejum, recomendamos 8 a 12 horas sem alimentação..."
                  value={item.answer}
                  onChange={(e) => updateItem(i, { answer: e.target.value })}
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
