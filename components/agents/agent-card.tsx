// Componente: Card de Agent Individual
// Feature: Meus Agentes IA

'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AgentWithPrompt } from '@/types/agents';

interface AgentCardProps {
  agent: AgentWithPrompt;
  isSelected?: boolean;
  onSelect: (agent: AgentWithPrompt) => void;
}

export function AgentCard({ agent, isSelected, onSelect }: AgentCardProps) {
  return (
    <Card 
      className={cn(
        "w-[200px] min-h-[112px] flex-shrink-0 border border-transparent hover:shadow-md transition-all cursor-pointer hover:bg-accent/50 flex flex-col justify-between",
        // ring-inset: anel dentro do card — evita corte pelo overflow-x do container pai
        isSelected && "ring-2 ring-inset ring-primary bg-accent/50"
      )}
      onClick={() => onSelect(agent)}
    >
      <CardHeader className="p-4 space-y-0">
        <CardTitle className="text-sm font-medium leading-tight truncate" title={agent.name}>
          {agent.name}
        </CardTitle>

      </CardHeader>
      
      {agent.template_name && (
        <CardContent className="p-4 pt-0">
          <div className="text-[10px] text-muted-foreground truncate" title={agent.template_name}>
            {agent.template_name}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
