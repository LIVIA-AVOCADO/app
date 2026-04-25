'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { ActionType, UraRule, UraCondition } from './types';

interface Team { id: string; name: string; color: string }
interface Agent { id: string; full_name: string }

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'assign_team',  label: 'Atribuir ao time' },
  { value: 'assign_agent', label: 'Atribuir ao agente' },
  { value: 'route_ai',     label: 'Rotear para IA' },
  { value: 'queue',        label: 'Fila de espera' },
  { value: 'auto_reply',   label: 'Resposta automática' },
];

const STRATEGIES = [
  { value: 'round_robin', label: 'Round-robin' },
  { value: 'least_busy',  label: 'Menos ocupado' },
  { value: 'random',      label: 'Aleatório' },
];

const CONDITION_TYPES = [
  { value: 'first_message_keyword', label: 'Palavras-chave (1ª mensagem)' },
  { value: 'contact_is_returning',  label: 'Contato recorrente' },
  { value: 'outside_hours',         label: 'Fora do horário comercial' },
];

interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: UraRule | null;
  teams: Team[];
  agents: Agent[];
  tenantId: string;
  onCreate: (data: Omit<UraRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onEdit: (id: string, data: Partial<UraRule>) => Promise<void>;
}

export function RuleFormDialog({
  open,
  onOpenChange,
  rule,
  teams,
  agents,
  onCreate,
  onEdit,
}: RuleFormDialogProps) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState(0);
  const [actionType, setActionType] = useState<ActionType>('assign_team');
  const [teamId, setTeamId] = useState('');
  const [strategy, setStrategy] = useState('round_robin');
  const [agentId, setAgentId] = useState('');
  const [queueTeamId, setQueueTeamId] = useState('');
  const [autoReplyMsg, setAutoReplyMsg] = useState('');
  const [conditions, setConditions] = useState<UraCondition[]>([]);
  const [newCondType, setNewCondType] = useState('first_message_keyword');
  const [newCondKeyword, setNewCondKeyword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (rule) {
      setName(rule.name);
      setPriority(rule.priority);
      setActionType(rule.action_type);
      setConditions(rule.conditions ?? []);
      const cfg = rule.action_config;
      setTeamId(String(cfg.team_id ?? ''));
      setStrategy(String(cfg.strategy ?? 'round_robin'));
      setAgentId(String(cfg.agent_id ?? ''));
      setQueueTeamId(String(cfg.target_team_id ?? ''));
      setAutoReplyMsg(String(cfg.message ?? ''));
    } else {
      setName('');
      setPriority(0);
      setActionType('assign_team');
      setTeamId('');
      setStrategy('round_robin');
      setAgentId('');
      setQueueTeamId('');
      setAutoReplyMsg('');
      setConditions([]);
    }
    setNewCondType('first_message_keyword');
    setNewCondKeyword('');
  }, [open, rule]);

  const buildActionConfig = (): Record<string, unknown> => {
    if (actionType === 'assign_team') return { team_id: teamId, strategy };
    if (actionType === 'assign_agent') return { agent_id: agentId };
    if (actionType === 'queue') return { target_team_id: queueTeamId || null };
    if (actionType === 'auto_reply') return { message: autoReplyMsg };
    return {};
  };

  const addCondition = () => {
    if (newCondType === 'first_message_keyword') {
      const kw = newCondKeyword.trim();
      if (!kw) return;
      // Verifica se já existe condição do mesmo tipo
      const existing = conditions.find((c) => c.type === 'first_message_keyword');
      if (existing) {
        const vals = (existing.value as string[]) ?? [];
        if (!vals.includes(kw)) {
          setConditions((prev) =>
            prev.map((c) =>
              c.type === 'first_message_keyword'
                ? { ...c, value: [...(c.value as string[]), kw] }
                : c
            )
          );
        }
      } else {
        setConditions((prev) => [
          ...prev,
          { type: 'first_message_keyword', op: 'contains_any', value: [kw] },
        ]);
      }
      setNewCondKeyword('');
    } else {
      if (conditions.some((c) => c.type === newCondType)) return;
      setConditions((prev) => [
        ...prev,
        { type: newCondType, op: 'eq', value: true },
      ]);
    }
  };

  const removeCondition = (type: string) => {
    setConditions((prev) => prev.filter((c) => c.type !== type));
  };

  const removeKeyword = (kw: string) => {
    setConditions((prev) =>
      prev
        .map((c) =>
          c.type === 'first_message_keyword'
            ? { ...c, value: (c.value as string[]).filter((v) => v !== kw) }
            : c
        )
        .filter((c) => c.type !== 'first_message_keyword' || (c.value as string[]).length > 0)
    );
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Nome é obrigatório';
    if (actionType === 'assign_team' && !teamId) return 'Selecione um time';
    if (actionType === 'assign_agent' && !agentId) return 'Selecione um agente';
    if (actionType === 'auto_reply' && !autoReplyMsg.trim()) return 'Informe a mensagem';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }
    setIsSaving(true);
    try {
      const data = {
        name: name.trim(),
        priority,
        is_active: rule?.is_active ?? true,
        conditions,
        action_type: actionType,
        action_config: buildActionConfig(),
      };
      if (rule) {
        await onEdit(rule.id, data);
      } else {
        await onCreate(data);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar regra');
    } finally {
      setIsSaving(false);
    }
  };

  const kwCondition = conditions.find((c) => c.type === 'first_message_keyword');
  const otherConditions = conditions.filter((c) => c.type !== 'first_message_keyword');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar regra' : 'Nova regra'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome + prioridade */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="rule-name">Nome *</Label>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Suporte — palavras-chave"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-priority">Prioridade</Label>
              <Input
                id="rule-priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                min={0}
                className="text-center"
              />
            </div>
          </div>

          {/* Ação */}
          <div className="space-y-1.5">
            <Label>Ação *</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v as ActionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Config de ação dinâmica */}
          {actionType === 'assign_team' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Time *</Label>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar time" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estratégia</Label>
                <Select value={strategy} onValueChange={setStrategy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {actionType === 'assign_agent' && (
            <div className="space-y-1.5">
              <Label>Agente *</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar agente" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === 'queue' && teams.length > 0 && (
            <div className="space-y-1.5">
              <Label>Fila do time (opcional)</Label>
              <Select value={queueTeamId} onValueChange={setQueueTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Fila geral" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Fila geral</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === 'auto_reply' && (
            <div className="space-y-1.5">
              <Label>Mensagem *</Label>
              <Textarea
                value={autoReplyMsg}
                onChange={(e) => setAutoReplyMsg(e.target.value)}
                placeholder="Olá! Em breve retornaremos..."
                rows={3}
                className="resize-none"
              />
            </div>
          )}

          {actionType === 'route_ai' && (
            <p className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">
              O agente IA padrão configurado no tenant será usado. Configure via{' '}
              <span className="font-medium">attendants</span>.
            </p>
          )}

          {/* Condições */}
          <div className="space-y-2">
            <Label>Condições <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <p className="text-xs text-muted-foreground">
              Sem condições, a regra aplica-se a todas as conversas novas.
            </p>

            {/* Keywords */}
            {kwCondition && (
              <div className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Palavras-chave (1ª mensagem contém qualquer)</p>
                  <button
                    type="button"
                    onClick={() => removeCondition('first_message_keyword')}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(kwCondition.value as string[]).map((kw) => (
                    <Badge key={kw} variant="secondary" className="gap-1 text-xs">
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        className="hover:text-destructive ml-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Outras condições */}
            {otherConditions.map((c) => (
              <div key={c.type} className="flex items-center justify-between p-2 rounded-lg border text-xs">
                <span>
                  {CONDITION_TYPES.find((ct) => ct.value === c.type)?.label ?? c.type}
                </span>
                <button
                  type="button"
                  onClick={() => removeCondition(c.type)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Adicionar condição */}
            <div className="flex gap-2">
              <Select value={newCondType} onValueChange={setNewCondType}>
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value} className="text-xs">
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newCondType === 'first_message_keyword' && (
                <Input
                  value={newCondKeyword}
                  onChange={(e) => setNewCondKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCondition(); } }}
                  placeholder="palavra"
                  className="h-8 text-xs w-32"
                />
              )}
              <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={addCondition}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : rule ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
