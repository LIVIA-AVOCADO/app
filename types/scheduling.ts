/**
 * types/scheduling.ts
 *
 * Tipos do Módulo de Agendamentos.
 * As tabelas sched_* não estão em types/database.ts (gerado automaticamente),
 * por isso declaramos os tipos manualmente aqui.
 */

// ---------------------------------------------------------------------------
// Enums / Literals
// ---------------------------------------------------------------------------

export type ResourceType = 'staff' | 'room' | 'equipment' | 'vehicle' | 'team';

export type AppointmentStatus =
  | 'held'
  | 'pending'
  | 'confirmed'
  | 'canceled'
  | 'completed'
  | 'no_show';

export type AppointmentSource = 'manual' | 'ai' | 'api';

export type AvailabilityMode = 'recurring' | 'open_with_blocks' | 'hybrid';

export type ExceptionType = 'block' | 'extra_open';

export type KnowledgeEntityType = 'service' | 'resource' | 'unit' | 'setting' | 'appointment';

// ---------------------------------------------------------------------------
// Entidades base
// ---------------------------------------------------------------------------

export interface SchedUnit {
  id: string;
  tenant_id: string;
  name: string;
  address_json: Record<string, unknown>;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchedResource {
  id: string;
  tenant_id: string;
  unit_id: string | null;
  resource_type: ResourceType;
  name: string;
  user_id: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchedService {
  id: string;
  tenant_id: string;
  name: string;
  service_type: string;
  description: string | null;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  price_cents: number | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SchedServiceResourceRequirement {
  id: string;
  tenant_id: string;
  service_id: string;
  required_resource_type: ResourceType;
  quantity: number;
  is_mandatory: boolean;
  preferred_unit_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SchedAvailabilityWindow {
  id: string;
  tenant_id: string;
  resource_id: string;
  day_of_week: number; // 0 = domingo, 6 = sábado
  start_time: string;  // HH:MM:SS
  end_time: string;    // HH:MM:SS
  is_active: boolean;
  created_at: string;
}

export interface SchedAvailabilityException {
  id: string;
  tenant_id: string;
  resource_id: string | null;
  unit_id: string | null;
  exception_type: ExceptionType;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_at: string;
}

export interface AutomationsConfig {
  confirmation_message_template?: string;
  reminder_hours_before?: number;
  cancellation_notify_contact?: boolean;
  reengage_no_show_hours?: number;
  auto_confirm_holds?: boolean;
}

export interface SchedSettings {
  tenant_id: string;
  allow_customer_choose_professional: boolean;
  allow_any_available_professional: boolean;
  min_notice_minutes: number;
  max_booking_window_days: number;
  slot_granularity_minutes: number;
  hold_duration_minutes: number;
  availability_mode: AvailabilityMode;
  automation_config: AutomationsConfig;
  created_at: string;
  updated_at: string;
}

export interface SchedAppointment {
  id: string;
  tenant_id: string;
  contact_id: string;
  unit_id: string | null;
  channel_id: string | null;
  start_at: string;
  end_at: string;
  hold_expires_at: string | null;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchedAppointmentService {
  id: string;
  appointment_id: string;
  service_id: string;
  quantity: number;
  created_at: string;
}

export interface SchedAppointmentResourceAllocation {
  id: string;
  tenant_id: string;
  appointment_id: string;
  resource_id: string;
  start_at: string;
  end_at: string;
  created_at: string;
}

export interface KnowledgeEntityLink {
  id: string;
  tenant_id: string;
  entity_type: KnowledgeEntityType;
  entity_id: string;
  base_conhecimento_id: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Tipos compostos para UI
// ---------------------------------------------------------------------------

export interface AppointmentWithDetails extends SchedAppointment {
  services: Pick<SchedService, 'id' | 'name' | 'duration_minutes'>[];
  resources: Pick<SchedResource, 'id' | 'name' | 'resource_type'>[];
  unit: Pick<SchedUnit, 'id' | 'name'> | null;
  contact: {
    id: string;
    name: string;
    phone: string | null;
  };
}

export interface SchedResourceWithUnit extends SchedResource {
  unit: Pick<SchedUnit, 'id' | 'name'> | null;
}

// ---------------------------------------------------------------------------
// Tipos de resposta das RPCs
// ---------------------------------------------------------------------------

export interface SchedSlotAllocation {
  resource_id: string;
  resource_type: ResourceType;
  name: string;
}

export interface SchedSlot {
  start_at: string;
  end_at: string;
  unit_id: string | null;
  slot_duration_minutes: number;
  suggested_allocations: SchedSlotAllocation[];
  confidence: 'high' | 'medium' | 'low';
}

export interface FindSlotsResult {
  slot_duration_minutes: number;
  explain: {
    service_total_minutes: number;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
    min_notice_minutes_applied: boolean;
    max_window_applied: boolean;
  };
  results: SchedSlot[];
  error?: string;
}

export interface HoldAppointmentResult {
  appointment_id?: string;
  status?: 'held';
  hold_expires_at?: string;
  start_at?: string;
  end_at?: string;
  allocations?: Array<{ resource_id: string; start_at: string; end_at: string }>;
  error?: string;
}

export interface ConfirmAppointmentResult {
  appointment_id?: string;
  status?: 'confirmed';
  start_at?: string;
  end_at?: string;
  n8n_events?: Array<{ event: string; status: string }>;
  error?: string;
}

export interface CancelAppointmentResult {
  appointment_id?: string;
  status?: 'canceled';
  error?: string;
}

export interface GetAgendaResult {
  date: string;
  appointments: Array<{
    appointment_id: string;
    start_at: string;
    end_at: string;
    status: AppointmentStatus;
    notes: string | null;
    contact: { id: string; name: string; phone: string | null };
    services: Array<{ service_id: string; name: string }>;
    resources: Array<{ resource_id: string; name: string; type: ResourceType }>;
  }>;
}

// ---------------------------------------------------------------------------
// Tipos de payload para automações n8n
// ---------------------------------------------------------------------------

export type SchedulingAutomationEvent =
  | 'scheduling.appointment.confirmed'
  | 'scheduling.appointment.canceled'
  | 'scheduling.appointment.rescheduled'
  | 'scheduling.appointment.completed'
  | 'scheduling.appointment.no_show';

export interface SchedulingAutomationPayload {
  event: SchedulingAutomationEvent;
  tenant_id: string;
  appointment_id: string;
  contact: {
    id: string;
    name: string;
    phone: string | null;
  };
  appointment: {
    start_at: string;
    end_at: string;
    unit_id: string | null;
    services: Array<{ service_id: string; name: string }>;
    resources: Array<{ resource_id: string; name: string; type: ResourceType }>;
  };
  automation_config: AutomationsConfig;
}
