'use client';

import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { StepProps, BusinessProfilePayload } from '@/types/onboarding';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export function BusinessProfileStep({ payload, onChange, disabled }: StepProps) {
  const data: BusinessProfilePayload = payload.business_profile ?? {};

  function update(patch: Partial<BusinessProfilePayload>) {
    onChange('business_profile', { ...data, ...patch });
  }

  function addRegion() {
    update({ service_regions: [...(data.service_regions ?? []), ''] });
  }

  function updateRegion(index: number, value: string) {
    const regions = [...(data.service_regions ?? [])];
    regions[index] = value;
    update({ service_regions: regions });
  }

  function removeRegion(index: number) {
    update({ service_regions: (data.service_regions ?? []).filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-6">
      <Field
        label="Descrição do negócio"
        hint="Descreva o que sua empresa faz, seus diferenciais e proposta de valor"
      >
        <Textarea
          placeholder="Ex: Somos um laboratório de análises clínicas com 15 anos de experiência, especializados em exames de rotina e diagnósticos rápidos..."
          value={data.description ?? ''}
          onChange={(e) => update({ description: e.target.value })}
          disabled={disabled}
          rows={5}
        />
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Regiões atendidas
          </label>
          <Button type="button" variant="outline" size="sm" onClick={addRegion} disabled={disabled}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
          </Button>
        </div>
        {(data.service_regions ?? []).length === 0 && (
          <p className="text-xs text-zinc-400 italic">Nenhuma região adicionada</p>
        )}
        <div className="space-y-2">
          {(data.service_regions ?? []).map((region, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Ex: Fortaleza, CE"
                value={region}
                onChange={(e) => updateRegion(i, e.target.value)}
                disabled={disabled}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeRegion(i)} disabled={disabled}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
