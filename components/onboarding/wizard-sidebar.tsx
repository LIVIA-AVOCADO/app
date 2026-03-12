'use client';

import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WizardStepConfig } from '@/types/onboarding';

interface WizardSidebarProps {
  steps: WizardStepConfig[];
  currentIndex: number;
  completedSteps: string[];
  onStepClick: (index: number) => void;
}

export function WizardSidebar({
  steps,
  currentIndex,
  completedSteps,
  onStepClick,
}: WizardSidebarProps) {
  return (
    <nav className="flex flex-col gap-1 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Etapas
      </p>

      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.key);
        const isCurrent   = index === currentIndex;
        const isAccessible = index <= currentIndex || isCompleted;

        return (
          <button
            key={step.key}
            onClick={() => isAccessible && onStepClick(index)}
            disabled={!isAccessible}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
              isCurrent
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : isCompleted
                  ? 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  : isAccessible
                    ? 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    : 'cursor-not-allowed text-zinc-300 dark:text-zinc-600'
            )}
          >
            <span className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs',
              isCurrent
                ? 'border-white bg-white text-zinc-900 dark:border-zinc-900 dark:bg-zinc-900 dark:text-white'
                : isCompleted
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-zinc-300 dark:border-zinc-600'
            )}>
              {isCompleted && !isCurrent
                ? <Check className="h-3 w-3" />
                : <Circle className={cn('h-2 w-2', isCurrent ? 'fill-zinc-900 dark:fill-white' : 'fill-zinc-300 dark:fill-zinc-600')} />
              }
            </span>

            <span className="truncate font-medium">{step.title}</span>

            {step.required && !isCompleted && (
              <span className="ml-auto shrink-0 text-[10px] text-zinc-400">*</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
