'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WizardSidebar } from './wizard-sidebar';
import { WizardRenderer } from './wizard-renderer';
import type {
  OnboardingSessionWithTemplate,
  OnboardingPayload,
  WizardStepConfig,
} from '@/types/onboarding';

// Steps padrão usados quando o template não define wizard_schema
const DEFAULT_STEPS: WizardStepConfig[] = [
  { key: 'company',            title: 'Empresa',            required: true  },
  { key: 'business_profile',   title: 'Perfil do Negócio',  required: false },
  { key: 'catalog',            title: 'Catálogo',           required: false },
  { key: 'faq',                title: 'FAQ',                required: false },
  { key: 'service',            title: 'Atendimento',        required: false },
  { key: 'script',             title: 'Roteiro',            required: false },
  { key: 'channel',            title: 'Canal (WhatsApp)',   required: false },
  { key: 'knowledge',          title: 'Base de Conhecimento', required: false },
  { key: 'agent',              title: 'Agente IA',          required: true  },
  { key: 'ai_operation',       title: 'Operação de IA',     required: false },
  { key: 'conversation_rules', title: 'Regras',             required: false },
  { key: 'tags',               title: 'Tags',               required: false },
];

interface WizardLayoutProps {
  session: OnboardingSessionWithTemplate;
}

export function WizardLayout({ session }: WizardLayoutProps) {
  const router = useRouter();

  const steps: WizardStepConfig[] =
    session.template.wizard_schema?.length > 0
      ? session.template.wizard_schema
      : DEFAULT_STEPS;

  // Iniciar no step atual salvo ou no primeiro
  const initialIndex = Math.max(
    0,
    steps.findIndex((s) => s.key === session.current_step)
  );

  const [currentIndex, setCurrentIndex]   = useState(initialIndex);
  const [payload, setPayload]             = useState<OnboardingPayload>(session.payload ?? {});
  const [completedSteps, setCompleted]    = useState<string[]>(session.completed_steps ?? []);
  const [isSaving, setIsSaving]           = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const currentStep = steps[currentIndex]!;
  const isLast = currentIndex === steps.length - 1;

  // Atualiza o payload local sem salvar no banco
  const handleChange = useCallback((stepKey: string, data: unknown) => {
    setPayload((prev) => ({ ...prev, [stepKey]: data }));
  }, []);

  // Salva o step atual no banco via PATCH
  async function saveCurrentStep(): Promise<boolean> {
    setIsSaving(true);
    setError(null);

    try {
      const stepData = payload[currentStep.key as keyof OnboardingPayload];

      const res = await fetch(`/api/onboarding/sessions/${session.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          stepKey:     currentStep.key,
          stepPayload: stepData ?? {},
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Erro ao salvar.');
        return false;
      }

      setCompleted((prev) =>
        prev.includes(currentStep.key) ? prev : [...prev, currentStep.key]
      );
      return true;
    } catch {
      setError('Erro de conexão. Tente novamente.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleNext() {
    const ok = await saveCurrentStep();
    if (!ok) return;

    if (isLast) {
      router.push(`/onboarding/${session.id}/review`);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  function handleBack() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-base font-semibold">
            Configuração do Workspace
          </h1>
          <p className="text-xs text-zinc-500">
            Template: {session.template.name}
          </p>
        </div>
        <p className="text-xs text-zinc-400">
          {currentIndex + 1} / {steps.length}
        </p>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 lg:block">
          <WizardSidebar
            steps={steps}
            currentIndex={currentIndex}
            completedSteps={completedSteps}
            onStepClick={setCurrentIndex}
          />
        </aside>

        {/* Content */}
        <main className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 px-6 py-8 max-w-3xl w-full mx-auto">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                {currentStep.title}
              </h2>
              {currentStep.description && (
                <p className="mt-1 text-sm text-zinc-500">{currentStep.description}</p>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <WizardRenderer
              step={currentStep}
              payload={payload}
              onChange={handleChange}
              disabled={isSaving}
            />
          </div>

          {/* Navigation footer */}
          <footer className="sticky bottom-0 flex items-center justify-between border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentIndex === 0 || isSaving}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={saveCurrentStep}
                disabled={isSaving}
              >
                <Save className="mr-1 h-4 w-4" />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>

              <Button onClick={handleNext} disabled={isSaving}>
                {isSaving ? 'Salvando...' : isLast ? 'Revisar' : 'Próximo'}
                {!isLast && <ChevronRight className="ml-1 h-4 w-4" />}
              </Button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
