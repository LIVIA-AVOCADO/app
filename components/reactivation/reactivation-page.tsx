'use client';

import { useState, useCallback } from 'react';
import { useForm, useFieldArray, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Save, ListOrdered, Settings2, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { reactivationFormSchema, type ReactivationFormDataValidated } from '@/lib/validations/reactivationValidation';
import { saveReactivationConfig } from '@/app/actions/reactivation';
import { SettingsCard } from './settings-card';
import { StepsList } from './steps-list';
import { TimelinePreview } from './timeline-preview';
import type { ReactivationPageData } from '@/types/reactivation';

interface ReactivationPageProps {
  initialData: ReactivationPageData;
}

function countStepsErrors(errors: FieldErrors<ReactivationFormDataValidated>): number {
  if (!errors.steps) return 0;
  const root = (errors.steps as { root?: { message?: string } }).root;
  const count = root?.message ? 1 : 0;
  return Array.isArray(errors.steps) ? count + errors.steps.filter(Boolean).length : count;
}

function countSettingsErrors(errors: FieldErrors<ReactivationFormDataValidated>): number {
  return errors.settings ? Object.keys(errors.settings).length : 0;
}

export function ReactivationPage({ initialData }: ReactivationPageProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('steps');

  // Converter steps do DB para form data
  const initialSteps = initialData.steps.map((step) => {
    return {
      wait_time_minutes: step.wait_time_minutes,
      // Se action_type e send_audio (escondido), converter para send_message
      action_type: step.action_type === 'send_audio' ? 'send_message' as const : step.action_type as Exclude<typeof step.action_type, 'send_audio'>,
      action_parameter: step.action_parameter || '',
      start_time: step.start_time ? step.start_time.slice(0, 5) : '',
      end_time: step.end_time ? step.end_time.slice(0, 5) : '',
      tag_ids: step.tags.map((t) => t.id),
    };
  });

  const form = useForm<ReactivationFormDataValidated>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(reactivationFormSchema) as any,
    defaultValues: {
      settings: {
        exhausted_action: initialData.settings?.exhausted_action || 'end_conversation',
        exhausted_message: initialData.settings?.exhausted_message || '',
        max_reactivation_window_minutes: initialData.settings?.max_reactivation_window_minutes ?? null,
        max_window_action: initialData.settings?.max_window_action || 'end_conversation',
        max_window_message: initialData.settings?.max_window_message || '',
      },
      steps: initialSteps.length > 0 ? initialSteps : [],
    },
  });

  const fieldArray = useFieldArray({
    control: form.control,
    name: 'steps',
  });

  // Watch para timeline reativa
  const watchedSteps = form.watch('steps');
  const watchedSettings = form.watch('settings');

  const { errors } = form.formState;
  const stepsErrorCount = countStepsErrors(errors);
  const settingsErrorCount = countSettingsErrors(errors);

  /** Ao falhar validacao client-side, navega para tab com erro */
  const onValidationError = useCallback(
    (formErrors: FieldErrors<ReactivationFormDataValidated>) => {
      const hasStepsErrors = !!formErrors.steps;
      const hasSettingsErrors = !!formErrors.settings;

      // Navegar para a primeira tab com erro
      if (hasStepsErrors && activeTab !== 'steps') {
        setActiveTab('steps');
      } else if (hasSettingsErrors && !hasStepsErrors && activeTab !== 'settings') {
        setActiveTab('settings');
      }

      // Toast informativo
      const parts: string[] = [];
      if (hasStepsErrors) parts.push('Etapas');
      if (hasSettingsErrors) parts.push('Configuracoes');

      toast.error('Corrija os erros antes de salvar', {
        description: `Verifique: ${parts.join(' e ')}`,
      });
    },
    [activeTab]
  );

  async function onSubmit(data: ReactivationFormDataValidated) {
    setIsSubmitting(true);
    try {
      const result = await saveReactivationConfig(data);

      if (result.success) {
        toast.success('Configuracao salva com sucesso!', {
          description: 'Todas as etapas e configuracoes foram atualizadas.',
        });
      } else {
        const mapped: Record<string, [string, string]> = {
          'Nao autenticado': ['Sessao expirada', 'Faca login novamente para continuar.'],
          'Tenant nao encontrado': ['Conta nao encontrada', 'Entre em contato com o suporte.'],
          'Dados invalidos': ['Dados invalidos', 'Verifique os campos e tente novamente.'],
        };
        const match = mapped[result.error || ''];
        toast.error(match?.[0] || 'Erro ao salvar', {
          description: match?.[1] || result.error || 'Tente novamente em alguns instantes.',
        });
      }
    } catch (err) {
      console.error('[Reactivation] Submit error:', err);
      toast.error('Erro de conexao', {
        description: err instanceof Error ? err.message : 'Verifique sua internet e tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <RotateCcw className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reativacao de Conversas</h1>
          <p className="text-muted-foreground text-sm">
            Configure as regras de reativacao automatica quando o contato nao responde.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onValidationError)}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="steps">
                  <ListOrdered className="h-4 w-4 mr-2" />
                  Etapas de Reativacao
                  {stepsErrorCount > 0 && (
                    <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                      {stepsErrorCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Configuracoes Gerais
                  {settingsErrorCount > 0 && (
                    <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                      {settingsErrorCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Botao Salvar no header das tabs */}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </div>

            {/* Banner de erro global */}
            {(stepsErrorCount > 0 || settingsErrorCount > 0) && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">
                  {stepsErrorCount + settingsErrorCount === 1
                    ? 'Existe 1 erro que precisa ser corrigido antes de salvar.'
                    : `Existem ${stepsErrorCount + settingsErrorCount} erros que precisam ser corrigidos antes de salvar.`}
                </p>
              </div>
            )}

            <TabsContent value="steps" className="mt-6">
              <div className="grid lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                  <StepsList
                    form={form}
                    fieldArray={fieldArray}
                    availableTags={initialData.availableTags}
                  />
                </div>

                <div className="lg:col-span-2">
                  <TimelinePreview
                    steps={watchedSteps || []}
                    settings={watchedSettings}
                    availableTags={initialData.availableTags}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <div className="max-w-2xl">
                <SettingsCard form={form} />
              </div>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}
