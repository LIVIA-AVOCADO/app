'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Users, Globe, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OnboardingSession, OnboardingTemplate } from '@/types/onboarding';

// ─── Nichos ──────────────────────────────────────────────────────────────────

const NICHES = [
  { key: 'saude',       emoji: '🏥', label: 'Saúde & Clínicas',       description: 'Clínicas, consultórios, laboratórios' },
  { key: 'ecommerce',   emoji: '🛍️', label: 'E-commerce & Varejo',    description: 'Lojas online e físicas' },
  { key: 'imobiliaria', emoji: '🏠', label: 'Imobiliária',             description: 'Venda, locação e administração' },
  { key: 'alimentacao', emoji: '🍽️', label: 'Restaurante & Delivery', description: 'Restaurantes e delivery' },
  { key: 'beleza',      emoji: '💆', label: 'Beleza & Estética',       description: 'Salões, spas e clínicas estéticas' },
  { key: 'educacao',    emoji: '🎓', label: 'Educação & Cursos',       description: 'Escolas, cursos e mentorias' },
  { key: 'fitness',     emoji: '🏋️', label: 'Academia & Fitness',     description: 'Academias e personal trainers' },
  { key: 'juridico',    emoji: '⚖️', label: 'Jurídico & Advocacia',   description: 'Escritórios e consultoria' },
  { key: 'construcao',  emoji: '🏗️', label: 'Construção & Reforma',  description: 'Construtoras e reformas' },
  { key: 'veiculos',    emoji: '🚗', label: 'Veículos & Auto',         description: 'Concessionárias e oficinas' },
  { key: 'tecnologia',  emoji: '💻', label: 'Tecnologia & SaaS',       description: 'Software, TI e serviços digitais' },
  { key: 'financeiro',  emoji: '💰', label: 'Financeiro & Seguros',    description: 'Crédito, seguros e fintech' },
] as const;

const EMPLOYEE_OPTIONS = [
  { value: 'só eu',      label: 'Só eu' },
  { value: '2 a 5',      label: '2 a 5' },
  { value: '6 a 20',     label: '6 a 20' },
  { value: '21 a 50',    label: '21 a 50' },
  { value: 'mais de 50', label: 'Mais de 50' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface EntryFormProps {
  templatesByNiche: Record<string, OnboardingTemplate[]>;
  latestSession: OnboardingSession | null;
  userName: string;
  userEmail: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function OnboardingEntryForm({
  templatesByNiche,
  latestSession,
  userName,
  userEmail,
}: EntryFormProps) {
  const router = useRouter();

  const [companyName,    setCompanyName]    = useState('');
  const [employeeCount,  setEmployeeCount]  = useState('');
  const [website,        setWebsite]        = useState('');
  const [hasNoWebsite,   setHasNoWebsite]   = useState(false);
  const [selectedNiche,  setSelectedNiche]  = useState<string | null>(null);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  const isValid =
    companyName.trim() &&
    employeeCount &&
    (hasNoWebsite || website.trim()) &&
    selectedNiche;

  function findTemplateForNiche(nicheKey: string): OnboardingTemplate | null {
    // Tenta match exato ou parcial pelo niche key
    for (const [dbNiche, templates] of Object.entries(templatesByNiche)) {
      if (
        dbNiche.toLowerCase().includes(nicheKey) ||
        nicheKey.includes(dbNiche.toLowerCase())
      ) {
        return templates[0] ?? null;
      }
    }
    // Fallback: primeiro template disponível
    const allTemplates = Object.values(templatesByNiche).flat();
    return allTemplates[0] ?? null;
  }

  async function handleSubmit() {
    if (!isValid || !selectedNiche) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const template = findTemplateForNiche(selectedNiche);
      if (!template) {
        setError('Nenhum template disponível. Entre em contato com o suporte.');
        return;
      }

      // 1. Cria a sessão
      const sessionRes = await fetch('/api/onboarding/sessions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ templateId: template.id }),
      });
      const sessionBody = await sessionRes.json();
      if (!sessionRes.ok) {
        setError(sessionBody.error ?? 'Erro ao criar sessão.');
        return;
      }
      const sessionId: string = sessionBody.data.id;

      // 2. Salva dados da empresa no payload da sessão
      await fetch(`/api/onboarding/sessions/${sessionId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          stepKey:     'company',
          stepPayload: {
            trade_name:     companyName.trim(),
            employee_count: employeeCount,
            website:        hasNoWebsite ? null : website.trim(),
            has_no_website: hasNoWebsite,
            niche:          selectedNiche,
          },
        }),
      });

      // 3. Vai para o chat
      router.push(`/onboarding/${sessionId}/chat`);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-10">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Vamos configurar seu workspace
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Algumas informações rápidas sobre sua empresa para começarmos
          </p>
        </div>

        {/* Retomar sessão em andamento */}
        {latestSession && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Você tem uma configuração em andamento
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Última atualização: {new Date(latestSession.updated_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 shrink-0"
              onClick={() => router.push(`/onboarding/${latestSession.id}/chat`)}
            >
              Continuar
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Card principal */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">

          {/* Seção 1 — Dados da empresa */}
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <Building2 className="h-4 w-4" />
              <span className="text-sm font-semibold">Dados da empresa</span>
            </div>

            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Nome da empresa *
              </label>
              <Input
                placeholder="Ex: Clínica Saúde Plena"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            {/* Funcionários */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <Users className="h-3.5 w-3.5" />
                Quantos funcionários? *
              </div>
              <div className="flex flex-wrap gap-2">
                {EMPLOYEE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEmployeeCount(opt.value)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                      employeeCount === opt.value
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Site */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <Globe className="h-3.5 w-3.5" />
                Site da empresa {!hasNoWebsite && '*'}
              </div>
              <Input
                placeholder="https://suaempresa.com.br"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={hasNoWebsite}
                className={hasNoWebsite ? 'opacity-40' : ''}
              />
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={hasNoWebsite}
                  onChange={(e) => {
                    setHasNoWebsite(e.target.checked);
                    if (e.target.checked) setWebsite('');
                  }}
                  className="h-3.5 w-3.5 rounded accent-zinc-900 dark:accent-zinc-100"
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Não tenho site</span>
              </label>
            </div>
          </div>

          {/* Seção 2 — Nicho */}
          <div className="p-6 space-y-4">
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Qual é o nicho da sua empresa? *
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {NICHES.map((niche) => {
                const isSelected = selectedNiche === niche.key;
                return (
                  <button
                    key={niche.key}
                    type="button"
                    onClick={() => setSelectedNiche(niche.key)}
                    className={`relative rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-900 dark:ring-zinc-100'
                        : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
                    }`}
                  >
                    {isSelected && (
                      <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                    )}
                    <span className="text-xl">{niche.emoji}</span>
                    <p className="mt-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">
                      {niche.label}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-400 leading-tight">
                      {niche.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <p className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {/* Botão */}
        <Button
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Preparando...</>
          ) : (
            <>Continuar <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>

        <p className="text-center text-xs text-zinc-400">
          Olá, {userName} · {userEmail}
        </p>
      </div>
    </div>
  );
}
