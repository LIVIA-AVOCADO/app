'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { saveDayIntervalsAction } from '@/app/actions/agent-schedule';
import type { WeeklyInterval } from '@/lib/validations/agent-schedule-validation';

const DAYS = [
  { dow: 0, label: 'Domingo' },
  { dow: 1, label: 'Segunda-feira' },
  { dow: 2, label: 'Terça-feira' },
  { dow: 3, label: 'Quarta-feira' },
  { dow: 4, label: 'Quinta-feira' },
  { dow: 5, label: 'Sexta-feira' },
  { dow: 6, label: 'Sábado' },
];

interface TimeInterval {
  start_time:      string;
  end_time:        string;
  offline_message: string;
}

function buildDayState(
  dayOfWeek: number,
  savedIntervals: WeeklyInterval[]
): { enabled: boolean; intervals: TimeInterval[] } {
  const forDay = savedIntervals.filter((i) => i.day_of_week === dayOfWeek && i.is_active);
  if (forDay.length === 0) {
    return { enabled: false, intervals: [{ start_time: '08:00', end_time: '18:00', offline_message: '' }] };
  }
  return {
    enabled: true,
    intervals: forDay.map((i) => ({
      start_time:      i.start_time,
      end_time:        i.end_time,
      offline_message: i.offline_message ?? '',
    })),
  };
}

interface DayRowProps {
  dow:           number;
  label:         string;
  savedIntervals: WeeklyInterval[];
}

function DayRow({ dow, label, savedIntervals }: DayRowProps) {
  const initial = buildDayState(dow, savedIntervals);
  const [enabled,   setEnabled]   = useState(initial.enabled);
  const [intervals, setIntervals] = useState<TimeInterval[]>(initial.intervals);
  const [isPending, startTransition] = useTransition();

  function addInterval() {
    setIntervals((prev) => [...prev, { start_time: '08:00', end_time: '18:00', offline_message: '' }]);
  }

  function removeInterval(index: number) {
    setIntervals((prev) => prev.filter((_, i) => i !== index));
  }

  function updateInterval(index: number, field: keyof TimeInterval, value: string) {
    setIntervals((prev) =>
      prev.map((interval, i) => (i === index ? { ...interval, [field]: value } : interval))
    );
  }

  function handleSave() {
    startTransition(async () => {
      const payload = enabled
        ? intervals.map((iv) => ({
            start_time:      iv.start_time,
            end_time:        iv.end_time,
            is_active:       true,
            offline_message: iv.offline_message.trim() || null,
          }))
        : [];

      const result = await saveDayIntervalsAction(dow, payload);
      if (result.success) {
        toast.success(`${label} salvo com sucesso`);
      } else {
        toast.error(result.error ?? 'Erro ao salvar');
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={isPending}
            id={`day-${dow}`}
          />
          <Label htmlFor={`day-${dow}`} className="text-sm font-medium cursor-pointer">
            {label}
          </Label>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
        </Button>
      </div>

      {enabled && (
        <div className="ml-9 space-y-2">
          {intervals.map((interval, index) => (
            <div key={index} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-8">De</Label>
                  <Input
                    type="time"
                    value={interval.start_time}
                    onChange={(e) => updateInterval(index, 'start_time', e.target.value)}
                    disabled={isPending}
                    className="w-32 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-8">até</Label>
                  <Input
                    type="time"
                    value={interval.end_time}
                    onChange={(e) => updateInterval(index, 'end_time', e.target.value)}
                    disabled={isPending}
                    className="w-32 text-sm"
                  />
                </div>
                {intervals.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeInterval(index)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">
                  Mensagem fora deste horário (opcional)
                </Label>
                <Textarea
                  placeholder="Ex: Nosso atendimento é de segunda a sexta, das 8h às 18h."
                  value={interval.offline_message}
                  onChange={(e) => updateInterval(index, 'offline_message', e.target.value)}
                  disabled={isPending}
                  rows={2}
                  maxLength={500}
                  className="mt-1 text-sm"
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addInterval}
            disabled={isPending}
            className="text-muted-foreground"
          >
            <Plus className="mr-1 h-3 w-3" />
            Adicionar intervalo
          </Button>
        </div>
      )}
    </div>
  );
}

interface WeeklyScheduleFormProps {
  savedIntervals: WeeklyInterval[];
}

export function WeeklyScheduleForm({ savedIntervals }: WeeklyScheduleFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Horário Semanal</CardTitle>
        <CardDescription>
          Configure os dias e horários em que o agente estará online. Você pode adicionar
          múltiplos intervalos no mesmo dia (ex: pausa para almoço).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {DAYS.map((day, index) => (
          <div key={day.dow}>
            <DayRow
              dow={day.dow}
              label={day.label}
              savedIntervals={savedIntervals}
            />
            {index < DAYS.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
