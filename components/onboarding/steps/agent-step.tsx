'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import type { StepProps, AgentPayload } from '@/types/onboarding';

const AGENT_TYPES = [
  { value: 'attendant', label: 'Atendimento' },
  { value: 'sales',     label: 'Vendas' },
];

const GENDERS = [
  { value: 'female', label: 'Feminino' },
  { value: 'male',   label: 'Masculino' },
];

export function AgentStep({ payload, onChange, disabled }: StepProps) {
  const data: AgentPayload = payload.agent ?? {};

  function update(patch: Partial<AgentPayload>) {
    onChange('agent', { ...data, ...patch });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-4">
          Identidade do Agente
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Nome do agente *">
            <Input
              placeholder="Ex: Lívia"
              value={data.name ?? ''}
              onChange={(e) => update({ name: e.target.value })}
              disabled={disabled}
            />
          </Field>

          <Field label="Tipo *">
            <select
              value={data.type ?? 'attendant'}
              onChange={(e) => update({ type: e.target.value })}
              disabled={disabled}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {AGENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Gênero">
            <select
              value={data.persona?.gender ?? 'female'}
              onChange={(e) => update({ persona: { ...data.persona, gender: e.target.value } })}
              disabled={disabled}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Idade">
            <Input
              placeholder="Ex: 32"
              value={data.persona?.age ?? ''}
              onChange={(e) => update({ persona: { ...data.persona, age: e.target.value } })}
              disabled={disabled}
            />
          </Field>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-4">
          Perfil e Comportamento
        </h3>
        <div className="space-y-4">
          <Field label="Objetivo principal *">
            <Textarea
              placeholder="Ex: Atender pacientes e orientar sobre exames, preparo e prazos."
              rows={3}
              value={data.profile?.objective ?? ''}
              onChange={(e) =>
                update({ profile: { ...data.profile, objective: e.target.value } })
              }
              disabled={disabled}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Estilo de comunicação">
              <Input
                placeholder="Ex: Humana, acolhedora e objetiva"
                value={data.profile?.communication ?? ''}
                onChange={(e) =>
                  update({ profile: { ...data.profile, communication: e.target.value } })
                }
                disabled={disabled}
              />
            </Field>
            <Field label="Personalidade">
              <Input
                placeholder="Ex: Atenciosa e organizada"
                value={data.profile?.personality ?? ''}
                onChange={(e) =>
                  update({ profile: { ...data.profile, personality: e.target.value } })
                }
                disabled={disabled}
              />
            </Field>
          </div>
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
