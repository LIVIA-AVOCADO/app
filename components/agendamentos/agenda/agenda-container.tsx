/* eslint-disable max-lines */
'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AppointmentCard } from './appointment-card';
import type { AppointmentWithDetails, AppointmentStatus, SchedUnit, SchedResource } from '@/types/scheduling';

interface AgendaContainerProps {
  tenantId:            string;
  initialAppointments: AppointmentWithDetails[];
  initialCount:        number;
  units:               SchedUnit[];
  resources:           SchedResource[];
}

const STATUS_LABELS: Record<string, string> = {
  all:       'Todos',
  held:      'Reservado',
  pending:   'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  canceled:  'Cancelado',
  no_show:   'Não compareceu',
};

export function AgendaContainer({
  tenantId,
  initialAppointments,
  initialCount,
  units,
}: AgendaContainerProps) {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>(initialAppointments);
  const [count, setCount]               = useState(initialCount);
  const [loading, setLoading]           = useState(false);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fromFilter, setFromFilter]     = useState('');
  const [toFilter, setToFilter]         = useState('');
  const [unitFilter, setUnitFilter]     = useState('all');

  // Dialog de cancelamento
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  // Dialog de reagendamento
  const [rescheduleId, setRescheduleId]       = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate]   = useState('');
  const [rescheduleTime, setRescheduleTime]   = useState('');
  const [rescheduling, setRescheduling]       = useState(false);

  const fetchAppointments = useCallback(async (params?: {
    status?: string;
    from?: string;
    to?: string;
    unitId?: string;
  }) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ tenantId });
      const s = params?.status ?? statusFilter;
      if (s && s !== 'all') qs.set('status', s);
      const f = params?.from  ?? fromFilter;
      const t = params?.to    ?? toFilter;
      const u = params?.unitId ?? unitFilter;
      if (f) qs.set('from', f);
      if (t) qs.set('to', t);
      if (u && u !== 'all') qs.set('unitId', u);

      const res = await fetch(`/api/agendamentos?${qs}`);
      if (!res.ok) throw new Error('Erro ao buscar agendamentos');
      const json = await res.json();
      setAppointments(json.data ?? []);
      setCount(json.count ?? 0);
    } catch {
      toast.error('Erro ao atualizar lista de agendamentos');
    } finally {
      setLoading(false);
    }
  }, [tenantId, statusFilter, fromFilter, toFilter, unitFilter]);

  const applyFilters = () => fetchAppointments();
  const clearFilters = () => {
    setStatusFilter('all');
    setFromFilter('');
    setToFilter('');
    setUnitFilter('all');
    fetchAppointments({ status: 'all', from: '', to: '', unitId: 'all' });
  };

  // ---- Ações ----

  const handleConfirm = async (id: string) => {
    try {
      const res = await fetch(`/api/agendamentos/${id}/confirmar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Erro ao confirmar');
      }
      toast.success('Agendamento confirmado');
      setAppointments((prev) =>
        prev.map((a) => a.id === id ? { ...a, status: 'confirmed' as AppointmentStatus } : a)
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao confirmar agendamento');
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelId) return;
    setCanceling(true);
    try {
      const res = await fetch(`/api/agendamentos/${cancelId}/cancelar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Erro ao cancelar');
      }
      toast.success('Agendamento cancelado');
      setAppointments((prev) =>
        prev.map((a) => a.id === cancelId ? { ...a, status: 'canceled' as AppointmentStatus } : a)
      );
      setCancelId(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao cancelar agendamento');
    } finally {
      setCanceling(false);
    }
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleId || !rescheduleDate || !rescheduleTime) {
      toast.error('Informe a nova data e horário');
      return;
    }
    setRescheduling(true);
    try {
      const newStartAt = `${rescheduleDate}T${rescheduleTime}:00`;
      const res = await fetch(`/api/agendamentos/${rescheduleId}/reagendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStartAt }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Erro ao reagendar');
      }
      toast.success('Agendamento reagendado');
      setRescheduleId(null);
      setRescheduleDate('');
      setRescheduleTime('');
      await fetchAppointments();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao reagendar');
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input type="date" value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} className="w-40" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input type="date" value={toFilter} onChange={(e) => setToFilter(e.target.value)} className="w-40" />
        </div>

        {units.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={applyFilters} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Filtrar'}
          </Button>
          <Button variant="outline" onClick={clearFilters} disabled={loading}>
            Limpar
          </Button>
        </div>

        <div className="ml-auto">
          <Button asChild>
            <Link href="/agendamentos/novo">
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Link>
          </Button>
        </div>
      </div>

      {/* Contagem */}
      <p className="text-sm text-muted-foreground">
        {count} agendamento{count !== 1 ? 's' : ''} encontrado{count !== 1 ? 's' : ''}
      </p>

      {/* Lista */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-3">
          <CalendarDays className="h-12 w-12 opacity-30" />
          <p className="text-sm">Nenhum agendamento encontrado.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/agendamentos/novo">Criar agendamento</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {appointments.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              onConfirm={handleConfirm}
              onCancel={(id) => setCancelId(id)}
              onReschedule={(id) => { setRescheduleId(id); setRescheduleDate(''); setRescheduleTime(''); }}
            />
          ))}
        </div>
      )}

      {/* Dialog: Cancelar */}
      <Dialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar agendamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)} disabled={canceling}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancelConfirm} disabled={canceling}>
              {canceling ? 'Cancelando...' : 'Cancelar agendamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reagendar */}
      <Dialog open={!!rescheduleId} onOpenChange={(open) => !open && setRescheduleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova data</Label>
              <Input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Novo horário</Label>
              <Input
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleId(null)} disabled={rescheduling}>
              Cancelar
            </Button>
            <Button onClick={handleRescheduleConfirm} disabled={rescheduling}>
              {rescheduling ? 'Reagendando...' : 'Confirmar reagendamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
