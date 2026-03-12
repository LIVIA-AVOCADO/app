'use client';

import type { WizardStepConfig, StepProps } from '@/types/onboarding';
import { CompanyStep }    from './steps/company-step';
import { AgentStep }      from './steps/agent-step';
import { KnowledgeStep }  from './steps/knowledge-step';
import { TagsStep }       from './steps/tags-step';

// Mapeamento estático: step.key → componente React
// Aberto para extensão (adicionar novos steps aqui), fechado para modificação no renderer.
const STEP_COMPONENTS: Record<string, React.ComponentType<StepProps>> = {
  company:    CompanyStep,
  agent:      AgentStep,
  knowledge:  KnowledgeStep,
  tags:       TagsStep,
};

interface WizardRendererProps extends StepProps {
  step: WizardStepConfig;
}

export function WizardRenderer({ step, payload, onChange, disabled }: WizardRendererProps) {
  const StepComponent = STEP_COMPONENTS[step.key];

  if (!StepComponent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Etapa <span className="font-mono font-medium">{step.key}</span> ainda não implementada.
        </p>
        <p className="mt-1 text-xs text-zinc-400">Disponível em breve.</p>
      </div>
    );
  }

  return <StepComponent payload={payload} onChange={onChange} disabled={disabled} />;
}
