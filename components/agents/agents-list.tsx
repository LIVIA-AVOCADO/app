// Componente: Lista de Agents (Master-Detail)
// Feature: Meus Agentes IA

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgentCard } from './agent-card';
import { AgentEditPanel } from './agent-edit-panel';
import type { AgentWithPrompt } from '@/types/agents';

interface AgentsListProps {
  agents: AgentWithPrompt[];
}

export function AgentsList({ agents }: AgentsListProps) {
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState<AgentWithPrompt | null>(null);

  const handleSuccess = () => {
    router.refresh(); // Refresh server data
  };

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">Nenhum agent encontrado</h3>
        <p className="text-muted-foreground max-w-md">
          Seu Neurocore ainda não possui agents configurados. Entre em contato com o
          administrador para configurar seus agents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      {/* Scroll horizontal: min-w-0 evita estourar o flex pai; py-1 dá espaço p/ ring/focus */}
      <div
        className="flex gap-4 overflow-x-auto py-1 pb-4 w-full min-w-0"
        style={{
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isSelected={selectedAgent?.id === agent.id}
            onSelect={setSelectedAgent}
          />
        ))}
      </div>

      {/* Painel de Edição (Master-Detail) */}
      {selectedAgent && (
        <>
          <div className="border-t my-6" />


          <AgentEditPanel
            key={selectedAgent.id}
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
            onSuccess={handleSuccess}
          />
        </>
      )}
    </div>
  );
}
