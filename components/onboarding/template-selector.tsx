'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OnboardingTemplate, OnboardingSession } from '@/types/onboarding';

interface TemplateSelectorProps {
  templatesByNiche: Record<string, OnboardingTemplate[]>;
  latestSession:    OnboardingSession | null;
}

export function TemplateSelector({
  templatesByNiche,
  latestSession,
}: TemplateSelectorProps) {
  const router = useRouter();
  const niches = Object.keys(templatesByNiche);

  const [selectedNiche,    setSelectedNiche]    = useState<string>(niches[0] ?? '');
  const [selectedTemplate, setSelectedTemplate] = useState<OnboardingTemplate | null>(
    templatesByNiche[niches[0] ?? '']?.[0] ?? null
  );
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const templates = templatesByNiche[selectedNiche] ?? [];

  function handleNicheChange(niche: string) {
    setSelectedNiche(niche);
    setSelectedTemplate(templatesByNiche[niche]?.[0] ?? null);
  }

  async function handleStart() {
    if (!selectedTemplate) return;

    setIsStarting(true);
    setError(null);

    try {
      const res = await fetch('/api/onboarding/sessions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ templateId: selectedTemplate.id }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? 'Erro ao iniciar onboarding.');
        return;
      }

      router.push(`/onboarding/${body.data.id}`);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsStarting(false);
    }
  }

  if (niches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-zinc-500">Nenhum template disponível.</p>
        <p className="mt-1 text-xs text-zinc-400">
          Entre em contato com o suporte para configurar seu workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      {/* Retomar sessão em andamento */}
      {latestSession && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Você tem uma configuração em andamento
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Última atualização:{' '}
                {new Date(latestSession.updated_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
              onClick={() => router.push(`/onboarding/${latestSession.id}`)}
            >
              Continuar
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Seleção de nicho e template */}
      <Card>
        <CardHeader>
          <CardTitle>Configurar seu Workspace</CardTitle>
          <CardDescription>
            Escolha o nicho da sua empresa e o template de configuração
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nicho */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nicho
            </label>
            <div className="flex flex-wrap gap-2">
              {niches.map((niche) => (
                <button
                  key={niche}
                  onClick={() => handleNicheChange(niche)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    selectedNiche === niche
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  {niche}
                </button>
              ))}
            </div>
          </div>

          {/* Templates do nicho */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Template
            </label>
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    selectedTemplate?.id === template.id
                      ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {template.name}
                    </span>
                    <Badge variant="secondary">v1</Badge>
                  </div>
                  {template.description && (
                    <p className="mt-1 text-xs text-zinc-500">{template.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleStart}
            disabled={!selectedTemplate || isStarting}
          >
            <Rocket className="mr-2 h-4 w-4" />
            {isStarting ? 'Iniciando...' : 'Iniciar Configuração'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
