'use client';

import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import type { StepProps, CompanyPayload } from '@/types/onboarding';

export function CompanyStep({ payload, onChange, disabled }: StepProps) {
  const data: CompanyPayload = payload.company ?? {};

  function update(patch: Partial<CompanyPayload>) {
    onChange('company', { ...data, ...patch });
  }

  function updateResponsible(
    type: 'technical' | 'financial',
    patch: Partial<{ name: string; whatsapp: string; email: string }>
  ) {
    update({
      responsibles: {
        ...data.responsibles,
        [type]: { ...data.responsibles?.[type], ...patch },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-4">
          Dados da Empresa
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome fantasia *">
            <Input
              placeholder="Ex: Minha Empresa"
              value={data.trade_name ?? ''}
              onChange={(e) => update({ trade_name: e.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label="CNPJ *">
            <Input
              placeholder="00.000.000/0001-00"
              value={data.cnpj ?? ''}
              onChange={(e) => update({ cnpj: e.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label="Telefone principal *">
            <Input
              placeholder="+55 88 99999-0000"
              value={data.phone ?? ''}
              onChange={(e) => update({ phone: e.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label="Plano">
            <Input
              placeholder="trial"
              value={data.plan ?? ''}
              onChange={(e) => update({ plan: e.target.value })}
              disabled={disabled}
            />
          </Field>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-4">
          Responsável Técnico
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Nome *">
            <Input
              placeholder="Nome completo"
              value={data.responsibles?.technical?.name ?? ''}
              onChange={(e) => updateResponsible('technical', { name: e.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label="WhatsApp *">
            <Input
              placeholder="+55 88 99999-0000"
              value={data.responsibles?.technical?.whatsapp ?? ''}
              onChange={(e) => updateResponsible('technical', { whatsapp: e.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label="Email *">
            <Input
              type="email"
              placeholder="email@empresa.com"
              value={data.responsibles?.technical?.email ?? ''}
              onChange={(e) => updateResponsible('technical', { email: e.target.value })}
              disabled={disabled}
            />
          </Field>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-4">
          Responsável Financeiro
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Nome *">
            <Input
              placeholder="Nome completo"
              value={data.responsibles?.financial?.name ?? ''}
              onChange={(e) => updateResponsible('financial', { name: e.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label="WhatsApp *">
            <Input
              placeholder="+55 88 99999-0000"
              value={data.responsibles?.financial?.whatsapp ?? ''}
              onChange={(e) => updateResponsible('financial', { whatsapp: e.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label="Email *">
            <Input
              type="email"
              placeholder="email@empresa.com"
              value={data.responsibles?.financial?.email ?? ''}
              onChange={(e) => updateResponsible('financial', { email: e.target.value })}
              disabled={disabled}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
      {children}
    </div>
  );
}
