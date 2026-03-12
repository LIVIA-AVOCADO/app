'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { StepProps, TagPayloadItem } from '@/types/onboarding';

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

const EMPTY_TAG: TagPayloadItem = {
  tag_name: '',
  color: '#3b82f6',
  order_index: 0,
  active: true,
  pause_ia_on_apply: false,
};

export function TagsStep({ payload, onChange, disabled }: StepProps) {
  const items: TagPayloadItem[] = payload.tags?.items ?? [];
  const [draft, setDraft] = useState<TagPayloadItem>({ ...EMPTY_TAG });

  function updateItems(next: TagPayloadItem[]) {
    onChange('tags', { items: next });
  }

  function addTag() {
    if (!draft.tag_name.trim()) return;
    updateItems([
      ...items,
      { ...draft, tag_name: draft.tag_name.trim(), order_index: items.length },
    ]);
    setDraft({ ...EMPTY_TAG });
  }

  function removeTag(index: number) {
    updateItems(items.filter((_, i) => i !== index));
  }

  function togglePauseIa(index: number) {
    updateItems(
      items.map((item, i) =>
        i === index ? { ...item, pause_ia_on_apply: !item.pause_ia_on_apply } : item
      )
    );
  }

  return (
    <div className="space-y-6">
      {/* Formulário de nova tag */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Nova tag
        </h3>

        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Nome
            </label>
            <Input
              placeholder="Ex: Aguardando humano"
              value={draft.tag_name}
              onChange={(e) => setDraft((d) => ({ ...d, tag_name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              disabled={disabled}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Cor
            </label>
            <div className="flex gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, color }))}
                  disabled={disabled}
                  className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: draft.color === color ? '#000' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={addTag}
            disabled={disabled || !draft.tag_name.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.pause_ia_on_apply ?? false}
            onChange={(e) => setDraft((d) => ({ ...d, pause_ia_on_apply: e.target.checked }))}
            disabled={disabled}
            className="rounded border-zinc-300"
          />
          Pausar IA ao aplicar esta tag
        </label>
      </div>

      {/* Lista de tags */}
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((tag, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {tag.tag_name}
              </span>
              {tag.pause_ia_on_apply && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  pausa IA
                </span>
              )}
              <button
                type="button"
                onClick={() => togglePauseIa(i)}
                disabled={disabled}
                className="text-xs text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
                title="Alternar pausa de IA"
              >
                ⏸
              </button>
              <button
                type="button"
                onClick={() => removeTag(i)}
                disabled={disabled}
                className="text-zinc-400 hover:text-red-500 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Nenhuma tag criada ainda. Tags são usadas para classificar conversas.
        </p>
      )}
    </div>
  );
}
