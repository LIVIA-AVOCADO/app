'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Bot, BookOpen, Tag, ChevronLeft,
  Rocket, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReviewSection, ReviewRow, EmptySection } from './review-sections';
import type { OnboardingSessionWithTemplate } from '@/types/onboarding';

interface ReviewLayoutProps {
  session: OnboardingSessionWithTemplate;
}

export function ReviewLayout({ session }: ReviewLayoutProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'activating' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const p = session.payload;
  const isProcessing = status === 'activating' || status === 'done';

  async function handleActivate() {
    setStatus('activating');
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/onboarding/activate/${session.id}`, { method: 'POST' });
      const body = await res.json();

      if (!res.ok) {
        setErrorMsg(body.error ?? 'Erro ao ativar workspace.');
        setStatus('error');
        return;
      }

      setStatus('done');
      setTimeout(() => router.push('/livechat'), 1200);
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
      setStatus('error');
    }
  }

  if (isProcessing) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        {status === 'activating' ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-zinc-400" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Criando seu workspace...</p>
            <p className="text-xs text-zinc-400">Isso leva alguns segundos</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Workspace criado com sucesso!</p>
            <p className="text-xs text-zinc-400">Redirecionando...</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-base font-semibold">Revisão Final</h1>
          <p className="text-xs text-zinc-500">Confirme as informações antes de criar seu workspace</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/onboarding/${session.id}`)}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Voltar ao wizard
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <ReviewSection icon={<Building2 className="h-4 w-4" />} title="Empresa">
            {p.company ? (
              <dl className="space-y-1 text-sm">
                <ReviewRow label="Nome"    value={p.company.trade_name} />
                <ReviewRow label="CNPJ"    value={p.company.cnpj} />
                <ReviewRow label="Telefone" value={p.company.phone} />
                {p.company.responsibles?.technical?.name && (
                  <ReviewRow label="Resp. Técnico" value={p.company.responsibles.technical.name} />
                )}
                {p.company.responsibles?.financial?.name && (
                  <ReviewRow label="Resp. Financeiro" value={p.company.responsibles.financial.name} />
                )}
              </dl>
            ) : <EmptySection />}
          </ReviewSection>

          <ReviewSection icon={<Bot className="h-4 w-4" />} title="Agente IA">
            {p.agent ? (
              <dl className="space-y-1 text-sm">
                <ReviewRow label="Nome"     value={p.agent.name} />
                <ReviewRow label="Tipo"     value={p.agent.type} />
                {p.agent.persona?.gender && <ReviewRow label="Gênero" value={p.agent.persona.gender} />}
                {p.agent.profile?.objective && <ReviewRow label="Objetivo" value={p.agent.profile.objective} />}
              </dl>
            ) : <EmptySection />}
          </ReviewSection>

          <ReviewSection icon={<BookOpen className="h-4 w-4" />} title="Base de Conhecimento">
            {p.knowledge ? (
              <dl className="space-y-1 text-sm">
                <ReviewRow label="Nome"      value={p.knowledge.name} />
                <ReviewRow label="Descrição" value={p.knowledge.description} />
                {(p.knowledge.extra_information?.length ?? 0) > 0 && (
                  <ReviewRow label="Extras" value={`${p.knowledge.extra_information!.length} item(s)`} />
                )}
              </dl>
            ) : <EmptySection />}
          </ReviewSection>

          <ReviewSection icon={<Tag className="h-4 w-4" />} title="Tags">
            {p.tags?.items && p.tags.items.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {p.tags.items.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: tag.color ?? '#3b82f6' }}
                  >
                    {tag.tag_name}
                  </span>
                ))}
              </div>
            ) : <EmptySection />}
          </ReviewSection>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-zinc-500">Template</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{session.template.name}</span>
              <Badge variant="secondary">{session.template.niche}</Badge>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>

      <footer className="sticky bottom-0 border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl">
          <Button className="w-full" size="lg" onClick={handleActivate} disabled={isProcessing}>
            <Rocket className="mr-2 h-4 w-4" />
            Criar Workspace
          </Button>
        </div>
      </footer>
    </div>
  );
}
