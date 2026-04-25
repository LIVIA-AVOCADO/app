'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Zap } from 'lucide-react';
import type { UraConfig, UraMode, OutsideHoursAction, BusinessHourSlot } from './types';

const DAYS = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

const MODE_CONFIG: Record<UraMode, { label: string; description: string }> = {
  direct: {
    label: 'Direto (sem regras)',
    description: 'Conversas entram na fila geral. Atribuição manual pelo super_admin.',
  },
  ura: {
    label: 'URA (regras automáticas)',
    description: 'Regras de roteamento determinam atribuição automática.',
  },
  intent_agent: {
    label: 'Agente de triagem (IA)',
    description: 'Um agente IA classifica a conversa antes de rotear.',
  },
};

const OUTSIDE_ACTIONS: Record<OutsideHoursAction, string> = {
  queue:      'Adicionar à fila',
  ai:         'Rotear para IA',
  auto_reply: 'Resposta automática',
  reject:     'Rejeitar conversa',
};

interface ModeConfigCardProps {
  config: UraConfig;
  onSave: (patch: Partial<UraConfig>) => Promise<void>;
}

export function ModeConfigCard({ config, onSave }: ModeConfigCardProps) {
  const [mode, setMode] = useState<UraMode>(config.mode);
  const [hours, setHours] = useState<Record<string, BusinessHourSlot | null>>(
    config.business_hours ?? {}
  );
  const [outsideAction, setOutsideAction] = useState<OutsideHoursAction>(config.outside_hours_action);
  const [outsideMessage, setOutsideMessage] = useState(config.outside_hours_message ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        mode,
        business_hours: hours,
        outside_hours_action: outsideAction,
        outside_hours_message: outsideMessage || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleModeChange = async (newMode: UraMode) => {
    setMode(newMode);
    await onSave({ mode: newMode });
  };

  const toggleDay = (day: string, enabled: boolean) => {
    setHours((prev) => ({
      ...prev,
      [day]: enabled ? { from: '08:00', to: '18:00' } : null,
    }));
  };

  const updateHour = (day: string, field: 'from' | 'to', value: string) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...(prev[day] as BusinessHourSlot), [field]: value },
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Configuração geral
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Modo */}
        <div className="space-y-2">
          <Label>Modo de operação</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.keys(MODE_CONFIG) as UraMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                className={`text-left p-3 rounded-lg border-2 transition-colors ${
                  mode === m
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <p className="text-sm font-medium">{MODE_CONFIG[m].label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                  {MODE_CONFIG[m].description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Horário comercial */}
        <div className="space-y-3">
          <Label>Horário comercial</Label>
          <div className="space-y-2">
            {DAYS.map(({ key, label }) => {
              const slot = hours[key] as BusinessHourSlot | null | undefined;
              const enabled = !!slot;
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-24 flex items-center gap-2">
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => toggleDay(key, v)}
                      id={`day-${key}`}
                    />
                    <Label htmlFor={`day-${key}`} className="text-sm cursor-pointer">
                      {label}
                    </Label>
                  </div>
                  {enabled && slot ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        value={slot.from}
                        onChange={(e) => updateHour(key, 'from', e.target.value)}
                        className="h-7 w-[100px] text-xs"
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={slot.to}
                        onChange={(e) => updateHour(key, 'to', e.target.value)}
                        className="h-7 w-[100px] text-xs"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Fechado</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Fora do horário */}
        <div className="space-y-3">
          <Label>Fora do horário comercial</Label>
          <Select value={outsideAction} onValueChange={(v) => setOutsideAction(v as OutsideHoursAction)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(OUTSIDE_ACTIONS) as [OutsideHoursAction, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {outsideAction === 'auto_reply' && (
            <Textarea
              value={outsideMessage}
              onChange={(e) => setOutsideMessage(e.target.value)}
              placeholder="Mensagem automática fora do horário..."
              rows={3}
              className="resize-none"
            />
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
