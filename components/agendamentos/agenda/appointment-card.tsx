'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, User, Scissors } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppointmentStatusBadge } from './appointment-status-badge';
import type { AppointmentWithDetails } from '@/types/scheduling';

interface AppointmentCardProps {
  appointment: AppointmentWithDetails;
  onConfirm:   (id: string) => void;
  onCancel:    (id: string) => void;
  onReschedule: (id: string) => void;
}

export function AppointmentCard({ appointment, onConfirm, onCancel, onReschedule }: AppointmentCardProps) {
  const start = new Date(appointment.start_at);
  const end   = new Date(appointment.end_at);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <User className="h-4 w-4 text-muted-foreground" />
            {appointment.contact?.name ?? '—'}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {format(start, "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
            {' – '}
            {format(end, 'HH:mm')}
          </div>
        </div>
        <AppointmentStatusBadge status={appointment.status} />
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Serviços */}
        {appointment.services.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <Scissors className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>{appointment.services.map((s) => s.name).join(', ')}</span>
          </div>
        )}

        {/* Recursos */}
        {appointment.resources.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <span>{appointment.resources.map((r) => r.name).join(', ')}</span>
          </div>
        )}

        {/* Unidade */}
        {appointment.unit && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {appointment.unit.name}
          </div>
        )}

        {/* Ações */}
        {(appointment.status === 'held' || appointment.status === 'pending') && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={() => onConfirm(appointment.id)}>
              Confirmar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReschedule(appointment.id)}>
              Reagendar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onCancel(appointment.id)}>
              Cancelar
            </Button>
          </div>
        )}

        {appointment.status === 'confirmed' && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => onReschedule(appointment.id)}>
              Reagendar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onCancel(appointment.id)}>
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
