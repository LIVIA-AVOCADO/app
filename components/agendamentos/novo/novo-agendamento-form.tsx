/* eslint-disable max-lines */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Clock, User, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { SchedService, SchedUnit, SchedResource, SchedSettings, SchedSlot } from '@/types/scheduling';

interface NovoAgendamentoFormProps {
  tenantId:  string;
  services:  SchedService[];
  units:     SchedUnit[];
  resources: SchedResource[];
  settings:  SchedSettings | null;
}

type Step = 'service' | 'slot' | 'contact' | 'confirm';

export function NovoAgendamentoForm({
  tenantId,
  services,
  units,
  resources,
  settings,
}: NovoAgendamentoFormProps) {
  const router = useRouter();

  const [step, setStep] = useState<Step>('service');

  // Step 1: Serviço
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedUnitId, setSelectedUnitId]       = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('');

  // Step 2: Slot
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [slots, setSlots]           = useState<SchedSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SchedSlot | null>(null);

  // Step 3: Contato
  const [contactSearch, setContactSearch]   = useState('');
  const [contactResults, setContactResults] = useState<Array<{ id: string; name: string; phone: string | null }>>([]);
  const [searchingContact, setSearchingContact] = useState(false);
  const [selectedContact, setSelectedContact]   = useState<{ id: string; name: string; phone: string | null } | null>(null);
  const [notes, setNotes] = useState('');

  // Step 4: Submit
  const [submitting, setSubmitting] = useState(false);

  const selectedService = services.find((s) => s.id === selectedServiceId);

  // ---- Navegação ----
  const goTo = (s: Step) => setStep(s);

  // ---- Buscar slots ----
  const searchSlots = async () => {
    if (!selectedServiceId || !dateFrom || !dateTo) {
      toast.error('Selecione o serviço e o intervalo de datas');
      return;
    }
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);
    try {
      const qs = new URLSearchParams({
        tenantId,
        dateFrom,
        dateTo,
      });
      qs.append('serviceId', selectedServiceId);
      if (selectedUnitId)    qs.set('unitId', selectedUnitId);
      if (selectedResourceId) qs.set('preferredResourceId', selectedResourceId);

      const res = await fetch(`/api/agendamentos/slots?${qs}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Erro ao buscar horários');
      }
      const json = await res.json();
      const result = json.data;
      setSlots(result?.results ?? []);
      if ((result?.results ?? []).length === 0) {
        toast.info('Nenhum horário disponível para o período selecionado');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao buscar horários');
    } finally {
      setLoadingSlots(false);
    }
  };

  // ---- Buscar contatos ----
  const searchContacts = async () => {
    if (contactSearch.trim().length < 2) {
      toast.error('Digite ao menos 2 caracteres para buscar');
      return;
    }
    setSearchingContact(true);
    setContactResults([]);
    try {
      const res = await fetch(`/api/contacts/search?tenantId=${tenantId}&search=${encodeURIComponent(contactSearch)}&limit=10`);
      if (!res.ok) throw new Error('Erro ao buscar contatos');
      const json = await res.json();
      setContactResults(json.data ?? []);
      if ((json.data ?? []).length === 0) {
        toast.info('Nenhum contato encontrado');
      }
    } catch {
      toast.error('Erro ao buscar contatos');
    } finally {
      setSearchingContact(false);
    }
  };

  // ---- Submit ----
  const handleSubmit = async () => {
    if (!selectedContact || !selectedSlot) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          contactId:           selectedContact.id,
          serviceIds:          [selectedServiceId],
          startAt:             selectedSlot.start_at,
          unitId:              (selectedSlot.unit_id ?? selectedUnitId) || null,
          preferredResourceId: selectedResourceId || null,
          source:              'manual',
          holdMinutes:         settings?.hold_duration_minutes ?? null,
          notes:               notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Erro ao criar agendamento');
      }
      toast.success('Agendamento criado com sucesso');
      router.push('/agendamentos');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar agendamento');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Indicador de steps */}
      <div className="flex items-center gap-2 text-sm">
        {(['service', 'slot', 'contact', 'confirm'] as Step[]).map((s, i) => {
          const labels: Record<Step, string> = { service: 'Serviço', slot: 'Horário', contact: 'Contato', confirm: 'Confirmar' };
          const active = s === step;
          const done   = ['service', 'slot', 'contact', 'confirm'].indexOf(step) > i;
          return (
            <div key={s} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${active ? 'bg-primary text-primary-foreground' : done ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {i + 1}
              </span>
              <span className={active ? 'font-medium' : 'text-muted-foreground'}>{labels[s]}</span>
              {i < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Step 1: Serviço */}
      {step === 'service' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Selecione o serviço</h2>

          <div className="space-y-2">
            <Label>Serviço *</Label>
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um serviço..." />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.duration_minutes} min
                    {s.price_cents ? ` — R$ ${(s.price_cents / 100).toFixed(2)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {units.length > 0 && (
            <div className="space-y-2">
              <Label>Unidade (opcional)</Label>
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Qualquer unidade</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {resources.length > 0 && (
            <div className="space-y-2">
              <Label>Profissional preferido (opcional)</Label>
              <Select value={selectedResourceId} onValueChange={setSelectedResourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer disponível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Qualquer disponível</SelectItem>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => goTo('slot')}
              disabled={!selectedServiceId}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Slot */}
      {step === 'slot' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Escolha o horário</h2>
          {selectedService && (
            <p className="text-sm text-muted-foreground">
              Serviço: <strong>{selectedService.name}</strong> — {selectedService.duration_minutes} min
            </p>
          )}

          <div className="flex gap-3 flex-wrap">
            <div className="space-y-2">
              <Label>Data inicial *</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data final *</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={searchSlots} disabled={loadingSlots || !dateFrom || !dateTo}>
                <Search className="h-4 w-4 mr-2" />
                {loadingSlots ? 'Buscando...' : 'Buscar horários'}
              </Button>
            </div>
          </div>

          {loadingSlots && (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          )}

          {!loadingSlots && slots.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map((slot, i) => {
                const start = new Date(slot.start_at);
                const end   = new Date(slot.end_at);
                const isSelected = selectedSlot?.start_at === slot.start_at;
                return (
                  <Card
                    key={i}
                    className={`cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">
                            {format(start, "EEE, dd/MM", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                          </p>
                        </div>
                      </div>
                      {slot.suggested_allocations.length > 0 && (
                        <div className="flex flex-col gap-1 items-end">
                          {slot.suggested_allocations.slice(0, 2).map((a) => (
                            <Badge key={a.resource_id} variant="secondary" className="text-xs">
                              {a.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => goTo('service')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <Button onClick={() => goTo('contact')} disabled={!selectedSlot}>
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Contato */}
      {step === 'contact' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Selecione o contato</h2>

          <div className="flex gap-2">
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchContacts()}
            />
            <Button onClick={searchContacts} disabled={searchingContact}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {searchingContact && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          )}

          {!searchingContact && contactResults.length > 0 && (
            <div className="space-y-2">
              {contactResults.map((c) => {
                const isSelected = selectedContact?.id === c.id;
                return (
                  <Card
                    key={c.id}
                    className={`cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                    onClick={() => setSelectedContact(c)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        {c.phone && (
                          <p className="text-xs text-muted-foreground">{c.phone}</p>
                        )}
                      </div>
                      {isSelected && <Badge className="ml-auto">Selecionado</Badge>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {selectedContact && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{selectedContact.name}</span>
              {selectedContact.phone && (
                <span className="text-xs text-muted-foreground">— {selectedContact.phone}</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-xs"
                onClick={() => setSelectedContact(null)}
              >
                Alterar
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              placeholder="Alguma informação adicional sobre o agendamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => goTo('slot')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <Button onClick={() => goTo('confirm')} disabled={!selectedContact}>
              Revisar
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmar */}
      {step === 'confirm' && selectedService && selectedSlot && selectedContact && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Revisão do agendamento</h2>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Serviço</span>
                <span className="text-sm font-medium">{selectedService.name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Data e hora</span>
                <span className="text-sm font-medium">
                  {format(new Date(selectedSlot.start_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              {selectedSlot.suggested_allocations.length > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Profissional</span>
                    <span className="text-sm font-medium">
                      {selectedSlot.suggested_allocations.map((a) => a.name).join(', ')}
                    </span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Contato</span>
                <span className="text-sm font-medium">{selectedContact.name}</span>
              </div>
              {selectedService.price_cents && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Valor</span>
                    <span className="text-sm font-medium">
                      R$ {(selectedService.price_cents / 100).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
              {notes && (
                <>
                  <Separator />
                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-muted-foreground shrink-0">Observações</span>
                    <span className="text-sm text-right">{notes}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => goTo('contact')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Criando...' : 'Confirmar agendamento'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
