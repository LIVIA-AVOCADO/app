'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, CalendarX2, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { saveScheduleExceptionAction, deleteScheduleExceptionAction } from '@/app/actions/agent-schedule';
import type { ScheduleException } from '@/lib/validations/agent-schedule-validation';

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

interface ExceptionFormState {
  exception_date: string;
  type:           'blocked' | 'custom';
  start_time:     string;
  end_time:       string;
  label:          string;
}

const EMPTY_FORM: ExceptionFormState = {
  exception_date: '',
  type:           'blocked',
  start_time:     '08:00',
  end_time:       '18:00',
  label:          '',
};

interface ExceptionsManagerProps {
  initialExceptions: ScheduleException[];
}

export function ExceptionsManager({ initialExceptions }: ExceptionsManagerProps) {
  const [exceptions, setExceptions] = useState<ScheduleException[]>(initialExceptions);
  const [open,       setOpen]       = useState(false);
  const [form,       setForm]       = useState<ExceptionFormState>(EMPTY_FORM);
  const [isPending,  startTransition] = useTransition();

  function handleField<K extends keyof ExceptionFormState>(key: K, value: ExceptionFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleAdd() {
    if (!form.exception_date) {
      toast.error('Selecione uma data');
      return;
    }

    startTransition(async () => {
      const result = await saveScheduleExceptionAction({
        exception_date: form.exception_date,
        type:           form.type,
        start_time:     form.type === 'custom' ? form.start_time : null,
        end_time:       form.type === 'custom' ? form.end_time   : null,
        label:          form.label.trim() || null,
      });

      if (result.success && result.data) {
        setExceptions((prev) => [...prev, result.data as ScheduleException]
          .sort((a, b) => a.exception_date.localeCompare(b.exception_date))
        );
        setForm(EMPTY_FORM);
        setOpen(false);
        toast.success('Exceção salva com sucesso');
      } else {
        toast.error(result.error ?? 'Erro ao salvar exceção');
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteScheduleExceptionAction(id);
      if (result.success) {
        setExceptions((prev) => prev.filter((e) => e.id !== id));
        toast.success('Exceção removida');
      } else {
        toast.error(result.error ?? 'Erro ao remover exceção');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Datas Especiais</CardTitle>
            <CardDescription>
              Feriados ou datas com horário diferente do padrão semanal. As exceções têm
              prioridade sobre o horário semanal.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-4 w-4" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Data Especial</DialogTitle>
                <DialogDescription>
                  Bloqueie um dia inteiro ou defina um horário personalizado para uma data específica.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Data */}
                <div className="space-y-1.5">
                  <Label htmlFor="exc-date">Data</Label>
                  <Input
                    id="exc-date"
                    type="date"
                    value={form.exception_date}
                    onChange={(e) => handleField('exception_date', e.target.value)}
                  />
                </div>

                {/* Label */}
                <div className="space-y-1.5">
                  <Label htmlFor="exc-label">Descrição (opcional)</Label>
                  <Input
                    id="exc-label"
                    placeholder="Ex: Natal, Recesso de julho"
                    value={form.label}
                    onChange={(e) => handleField('label', e.target.value)}
                    maxLength={100}
                  />
                </div>

                {/* Tipo */}
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={form.type === 'blocked' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleField('type', 'blocked')}
                      className="flex-1"
                    >
                      <CalendarX2 className="mr-1.5 h-4 w-4" />
                      Dia bloqueado
                    </Button>
                    <Button
                      type="button"
                      variant={form.type === 'custom' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleField('type', 'custom')}
                      className="flex-1"
                    >
                      <Clock className="mr-1.5 h-4 w-4" />
                      Horário especial
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {form.type === 'blocked'
                      ? 'O agente ficará offline o dia inteiro nesta data.'
                      : 'O agente usará este horário em vez do horário semanal padrão.'}
                  </p>
                </div>

                {/* Horários (só para tipo custom) */}
                {form.type === 'custom' && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-6">De</Label>
                      <Input
                        type="time"
                        value={form.start_time}
                        onChange={(e) => handleField('start_time', e.target.value)}
                        className="w-32 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-8">até</Label>
                      <Input
                        type="time"
                        value={form.end_time}
                        onChange={(e) => handleField('end_time', e.target.value)}
                        className="w-32 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button onClick={handleAdd} disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {exceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma data especial configurada.
          </p>
        ) : (
          <ul className="divide-y">
            {exceptions.map((exc) => (
              <li key={exc.id} className="flex items-center justify-between py-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {formatDate(exc.exception_date)}
                    </span>
                    {exc.label && (
                      <span className="text-sm text-muted-foreground">— {exc.label}</span>
                    )}
                    <Badge variant={exc.type === 'blocked' ? 'destructive' : 'secondary'} className="text-xs">
                      {exc.type === 'blocked' ? 'Bloqueado' : 'Personalizado'}
                    </Badge>
                  </div>
                  {exc.type === 'custom' && exc.start_time && exc.end_time && (
                    <p className="text-xs text-muted-foreground">
                      {exc.start_time.slice(0, 5)} — {exc.end_time.slice(0, 5)}
                    </p>
                  )}
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(exc.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
