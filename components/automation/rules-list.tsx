'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { RuleFormDialog } from './rule-form-dialog';
import type { UraRule } from './types';

interface Team { id: string; name: string; color: string }
interface Agent { id: string; full_name: string }

const ACTION_LABELS: Record<string, string> = {
  assign_team:       'Atribuir ao time',
  assign_agent:      'Atribuir ao agente',
  assign_percentage: 'Distribuição %',
  route_ai:          'Rotear para IA',
  queue:             'Fila de espera',
  auto_reply:        'Resposta automática',
};

const ACTION_COLORS: Record<string, string> = {
  assign_team:       'bg-blue-500/10 text-blue-600 border-blue-200',
  assign_agent:      'bg-green-500/10 text-green-600 border-green-200',
  assign_percentage: 'bg-violet-500/10 text-violet-600 border-violet-200',
  route_ai:          'bg-orange-500/10 text-orange-600 border-orange-200',
  queue:             'bg-gray-100 text-gray-600 border-gray-200',
  auto_reply:        'bg-yellow-500/10 text-yellow-600 border-yellow-200',
};

interface RulesListProps {
  rules: UraRule[];
  teams: Team[];
  agents: Agent[];
  tenantId: string;
  onCreate: (data: Omit<UraRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onEdit: (id: string, data: Partial<UraRule>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
}

export function RulesList({
  rules,
  teams,
  agents,
  tenantId,
  onCreate,
  onEdit,
  onDelete,
  onToggle,
}: RulesListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<UraRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UraRule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // toast handled by parent
    } finally {
      setIsDeleting(false);
    }
  };

  function getActionSummary(rule: UraRule): string {
    const cfg = rule.action_config;
    if (rule.action_type === 'assign_team') {
      const t = teams.find((t) => t.id === cfg.team_id);
      return t ? t.name : 'Time não encontrado';
    }
    if (rule.action_type === 'assign_agent') {
      const a = agents.find((a) => a.id === cfg.agent_id);
      return a ? a.full_name : 'Agente não encontrado';
    }
    if (rule.action_type === 'auto_reply') {
      const msg = String(cfg.message ?? '');
      return msg.length > 40 ? msg.slice(0, 40) + '…' : msg;
    }
    if (rule.action_type === 'queue') {
      const t = teams.find((t) => t.id === cfg.target_team_id);
      return t ? `Fila: ${t.name}` : 'Fila geral';
    }
    return '';
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Regras de roteamento</CardTitle>
            <Button
              size="sm"
              onClick={() => { setEditingRule(null); setFormOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova regra
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Executadas em ordem de prioridade (menor número = maior prioridade).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <p className="text-sm">Nenhuma regra criada.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditingRule(null); setFormOpen(true); }}
              >
                Criar primeira regra
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-center gap-3 px-4 py-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />

                  <div className="w-8 text-center">
                    <span className="text-xs font-mono text-muted-foreground">{rule.priority}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${!rule.is_active ? 'text-muted-foreground line-through' : ''}`}>
                        {rule.name}
                      </p>
                      <Badge variant="outline" className={`text-xs ${ACTION_COLORS[rule.action_type] ?? ''}`}>
                        {ACTION_LABELS[rule.action_type] ?? rule.action_type}
                      </Badge>
                    </div>
                    {getActionSummary(rule) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{getActionSummary(rule)}</p>
                    )}
                    {rule.conditions.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {rule.conditions.length} condição{rule.conditions.length > 1 ? 'ões' : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(v) => onToggle(rule.id, v)}
                      aria-label={rule.is_active ? 'Desativar' : 'Ativar'}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setEditingRule(rule); setFormOpen(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(rule)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <RuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        rule={editingRule}
        teams={teams}
        agents={agents}
        tenantId={tenantId}
        onCreate={onCreate}
        onEdit={onEdit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta regra de roteamento será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
