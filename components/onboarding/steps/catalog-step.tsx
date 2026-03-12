'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { StepProps, CatalogPayload, CatalogItem } from '@/types/onboarding';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

const EMPTY_ITEM: CatalogItem = { name: '' };

export function CatalogStep({ payload, onChange, disabled }: StepProps) {
  const data: CatalogPayload = payload.catalog ?? {};
  const items = data.items ?? [];

  function update(newItems: CatalogItem[]) {
    onChange('catalog', { ...data, items: newItems });
  }

  function addItem() {
    update([...items, { ...EMPTY_ITEM }]);
  }

  function updateItem(index: number, patch: Partial<CatalogItem>) {
    update(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    update(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {items.length === 0 ? 'Nenhum item adicionado' : `${items.length} item(s)`}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={disabled}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Item {i + 1}
              </span>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={disabled}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome *">
                <Input
                  placeholder="Ex: Hemograma Completo"
                  value={item.name}
                  onChange={(e) => updateItem(i, { name: e.target.value })}
                  disabled={disabled}
                />
              </Field>
              <Field label="Código">
                <Input
                  placeholder="Ex: LAB-001"
                  value={item.code ?? ''}
                  onChange={(e) => updateItem(i, { code: e.target.value })}
                  disabled={disabled}
                />
              </Field>
              <Field label="Tipo / Categoria">
                <Input
                  placeholder="Ex: Exame, Produto, Serviço"
                  value={item.type ?? ''}
                  onChange={(e) => updateItem(i, { type: e.target.value })}
                  disabled={disabled}
                />
              </Field>
              <Field label="Preço (R$)">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={item.price ?? ''}
                  onChange={(e) => updateItem(i, { price: e.target.value ? Number(e.target.value) : undefined })}
                  disabled={disabled}
                />
              </Field>
              <Field label="Prazo / Entrega">
                <Input
                  placeholder="Ex: 24h, 3 dias úteis"
                  value={item.delivery_time ?? ''}
                  onChange={(e) => updateItem(i, { delivery_time: e.target.value })}
                  disabled={disabled}
                />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
