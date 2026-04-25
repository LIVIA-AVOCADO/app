'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ModeConfigCard } from './mode-config-card';
import { RulesList } from './rules-list';
import type { UraConfig, UraRule } from './types';

interface Team { id: string; name: string; color: string }
interface Agent { id: string; full_name: string }

interface AutomationContentProps {
  tenantId: string;
  initialConfig: UraConfig | null;
  initialRules: UraRule[];
  teams: Team[];
  agents: Agent[];
}

const DEFAULT_BUSINESS_HOURS = {
  mon: { from: '08:00', to: '18:00' },
  tue: { from: '08:00', to: '18:00' },
  wed: { from: '08:00', to: '18:00' },
  thu: { from: '08:00', to: '18:00' },
  fri: { from: '08:00', to: '18:00' },
  sat: null,
  sun: null,
};

export function AutomationContent({
  tenantId,
  initialConfig,
  initialRules,
  teams,
  agents,
}: AutomationContentProps) {
  const [config, setConfig] = useState<UraConfig>(
    initialConfig ?? {
      id: '',
      tenant_id: tenantId,
      mode: 'direct',
      business_hours: DEFAULT_BUSINESS_HOURS,
      outside_hours_action: 'queue',
      outside_hours_message: null,
      updated_at: '',
    }
  );
  const [rules, setRules] = useState<UraRule[]>(initialRules);

  const saveConfig = useCallback(async (patch: Partial<UraConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    const res = await fetch('/api/automation/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        mode: next.mode,
        business_hours: next.business_hours,
        outside_hours_action: next.outside_hours_action,
        outside_hours_message: next.outside_hours_message,
      }),
    });
    if (!res.ok) {
      setConfig(config);
      const json = await res.json().catch(() => ({}));
      toast.error((json as { error?: string }).error ?? 'Erro ao salvar configuração');
    } else {
      toast.success('Configuração salva');
    }
  }, [config, tenantId]);

  const handleCreateRule = useCallback(async (data: Omit<UraRule, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
    const res = await fetch('/api/automation/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, ...data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Erro ao criar regra');
    setRules((prev) => [...prev, json.rule].sort((a, b) => a.priority - b.priority));
    toast.success('Regra criada');
  }, [tenantId]);

  const handleEditRule = useCallback(async (ruleId: string, data: Partial<UraRule>) => {
    const res = await fetch(`/api/automation/rules/${ruleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, ...data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar regra');
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, ...json.rule } : r))
        .sort((a, b) => a.priority - b.priority)
    );
    toast.success('Regra atualizada');
  }, [tenantId]);

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    const res = await fetch(`/api/automation/rules/${ruleId}?tenantId=${tenantId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error((json as { error?: string }).error ?? 'Erro ao excluir regra');
    }
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    toast.success('Regra excluída');
  }, [tenantId]);

  const handleToggleRule = useCallback(async (ruleId: string, isActive: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, is_active: isActive } : r)));
    const res = await fetch(`/api/automation/rules/${ruleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, is_active: isActive }),
    });
    if (!res.ok) {
      setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, is_active: !isActive } : r)));
      toast.error('Erro ao atualizar regra');
    }
  }, [tenantId]);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Automação</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure como novas conversas são roteadas e atribuídas
          </p>
        </div>

        <ModeConfigCard config={config} onSave={saveConfig} />

        {config.mode !== 'direct' && (
          <RulesList
            rules={rules}
            teams={teams}
            agents={agents}
            tenantId={tenantId}
            onCreate={handleCreateRule}
            onEdit={handleEditRule}
            onDelete={handleDeleteRule}
            onToggle={handleToggleRule}
          />
        )}
      </div>
    </div>
  );
}
