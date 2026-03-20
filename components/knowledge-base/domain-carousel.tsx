'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DomainWithCount } from '@/types/knowledge-base';

interface DomainCarouselProps {
  domains: DomainWithCount[];
  selectedDomainId: string | null;
  onSelectDomain: (domainId: string) => void;
  onOpenCreateDialog: () => void;
}

/**
 * Carousel de Domínios de Conhecimento
 *
 * Features:
 * - Scroll horizontal com domínios
 * - Botão "+ Nova Base" no header
 * - Primeiro domínio selecionado por padrão
 * - Mostra contagem de bases (publicadas/processando)
 */
export function DomainCarousel({
  domains,
  selectedDomainId,
  onSelectDomain,
  onOpenCreateDialog,
}: DomainCarouselProps) {
  return (
    <div className="space-y-4 w-full min-w-0 max-w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Base de Conhecimento</h2>
        <Button onClick={onOpenCreateDialog} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nova Base
        </Button>
      </div>

      {domains.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Nenhum domínio configurado
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Entre em contato com o administrador para configurar domínios
          </p>
        </div>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto py-1 pb-4 px-0.5 w-full min-w-0"
          style={{
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {domains.map((domain) => {
            const isSelected = selectedDomainId === domain.id;

            return (
              <button
                key={domain.id}
                onClick={() => onSelectDomain(domain.id)}
                className={cn(
                  'flex flex-col items-start justify-center',
                  'min-w-[180px] min-h-[100px] h-[100px] shrink-0',
                  'rounded-lg border-2 p-4',
                  'transition-all duration-200',
                  'hover:border-primary/50 hover:bg-accent/50',
                  // ring-inset + sem ring-offset: anel não é cortado pelo overflow do carrossel
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  isSelected
                    ? 'border-primary bg-accent shadow-md ring-2 ring-inset ring-primary/35'
                    : 'border-border bg-card'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{getDomainIcon(domain.domain)}</span>
                  <h3
                    className={cn(
                      'font-semibold text-sm',
                      isSelected ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {domain.domain}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{domain.bases_count} {domain.bases_count === 1 ? 'base' : 'bases'}</span>
                  {domain.processing_count > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-amber-600">
                        ⏳ {domain.processing_count} processando
                      </span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Helper: retorna emoji baseado no nome do domínio
 */
function getDomainIcon(domainName: string): string {
  const name = domainName.toLowerCase();

  if (name.includes('faq') || name.includes('perguntas')) return '📚';
  if (name.includes('polít') || name.includes('policy')) return '📋';
  if (name.includes('doc') || name.includes('manual')) return '📖';
  if (name.includes('proced') || name.includes('process')) return '💼';
  if (name.includes('suporte') || name.includes('support')) return '🛟';
  if (name.includes('técn') || name.includes('tech')) return '🔧';
  if (name.includes('produto') || name.includes('product')) return '📦';
  if (name.includes('venda') || name.includes('sales')) return '💰';

  return '📁'; // default
}
