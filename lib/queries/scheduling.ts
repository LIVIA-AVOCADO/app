/**
 * lib/queries/scheduling.ts
 *
 * Queries Supabase para o Módulo de Agendamentos.
 * As tabelas sched_* não estão em types/database.ts, portanto usamos
 * (supabase as any) para evitar erros de tipo — padrão estabelecido no projeto.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
import { createClient } from '@/lib/supabase/server';
import type {
  SchedUnit,
  SchedResource,
  SchedService,
  SchedServiceResourceRequirement,
  SchedAvailabilityWindow,
  SchedAvailabilityException,
  SchedSettings,
  AppointmentWithDetails,
  FindSlotsResult,
  HoldAppointmentResult,
  ConfirmAppointmentResult,
  CancelAppointmentResult,
  GetAgendaResult,
  AppointmentStatus,
  ResourceType,
} from '@/types/scheduling';

// =============================================================================
// UNIDADES
// =============================================================================

export async function getUnits(tenantId: string): Promise<SchedUnit[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_units')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function getUnitById(id: string, tenantId: string): Promise<SchedUnit | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_units')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) return null;
  return data;
}

export async function createUnit(
  payload: Pick<SchedUnit, 'tenant_id' | 'name' | 'address_json' | 'timezone'>
): Promise<SchedUnit> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_units')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUnit(
  id: string,
  tenantId: string,
  updates: Partial<Pick<SchedUnit, 'name' | 'address_json' | 'timezone' | 'is_active'>>
): Promise<SchedUnit> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_units')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteUnit(id: string, tenantId: string): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('sched_units')
    .update({ is_active: false })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}

// =============================================================================
// RECURSOS
// =============================================================================

export async function getResources(
  tenantId: string,
  filters?: { resourceType?: ResourceType; unitId?: string }
): Promise<SchedResource[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('sched_resources')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name');

  if (filters?.resourceType) query = query.eq('resource_type', filters.resourceType);
  if (filters?.unitId)       query = query.eq('unit_id', filters.unitId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getResourceById(id: string, tenantId: string): Promise<SchedResource | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_resources')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) return null;
  return data;
}

export async function createResource(
  payload: Pick<SchedResource, 'tenant_id' | 'name' | 'resource_type'> &
    Partial<Pick<SchedResource, 'unit_id' | 'user_id' | 'metadata'>>
): Promise<SchedResource> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_resources')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateResource(
  id: string,
  tenantId: string,
  updates: Partial<Pick<SchedResource, 'name' | 'resource_type' | 'unit_id' | 'user_id' | 'metadata' | 'is_active'>>
): Promise<SchedResource> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_resources')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteResource(id: string, tenantId: string): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('sched_resources')
    .update({ is_active: false })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}

// =============================================================================
// SERVIÇOS
// =============================================================================

export async function getServices(
  tenantId: string,
  options?: { search?: string; onlyActive?: boolean }
): Promise<SchedService[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('sched_services')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');

  if (options?.onlyActive !== false) query = query.eq('is_active', true);
  if (options?.search) query = query.ilike('name', `%${options.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getServiceById(id: string, tenantId: string): Promise<SchedService | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_services')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) return null;
  return data;
}

export async function createService(
  payload: Pick<SchedService, 'tenant_id' | 'name' | 'duration_minutes'> &
    Partial<Pick<SchedService, 'description' | 'service_type' | 'buffer_before_minutes' | 'buffer_after_minutes' | 'price_cents' | 'metadata'>>
): Promise<SchedService> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_services')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateService(
  id: string,
  tenantId: string,
  updates: Partial<Pick<SchedService, 'name' | 'description' | 'duration_minutes' | 'buffer_before_minutes' | 'buffer_after_minutes' | 'price_cents' | 'is_active' | 'metadata'>>
): Promise<SchedService> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_services')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteService(id: string, tenantId: string): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('sched_services')
    .update({ is_active: false })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}

// =============================================================================
// REQUISITOS DE RECURSO POR SERVIÇO
// =============================================================================

export async function getServiceRequirements(serviceId: string): Promise<SchedServiceResourceRequirement[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_service_resource_requirements')
    .select('*')
    .eq('service_id', serviceId);

  if (error) throw error;
  return data ?? [];
}

// =============================================================================
// DISPONIBILIDADE
// =============================================================================

export async function getAvailabilityWindows(resourceId: string): Promise<SchedAvailabilityWindow[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_availability_windows')
    .select('*')
    .eq('resource_id', resourceId)
    .order('day_of_week')
    .order('start_time');

  if (error) throw error;
  return data ?? [];
}

export async function upsertAvailabilityWindow(
  payload: Omit<SchedAvailabilityWindow, 'id' | 'created_at'>
): Promise<SchedAvailabilityWindow> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_availability_windows')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAvailabilityWindow(id: string, tenantId: string): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('sched_availability_windows')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}

export async function getAvailabilityExceptions(
  tenantId: string,
  filters?: { resourceId?: string; unitId?: string }
): Promise<SchedAvailabilityException[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('sched_availability_exceptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('start_at');

  if (filters?.resourceId) query = query.eq('resource_id', filters.resourceId);
  if (filters?.unitId)     query = query.eq('unit_id', filters.unitId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertAvailabilityException(
  payload: Omit<SchedAvailabilityException, 'id' | 'created_at'>
): Promise<SchedAvailabilityException> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_availability_exceptions')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAvailabilityException(id: string, tenantId: string): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('sched_availability_exceptions')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}

// =============================================================================
// CONFIGURAÇÕES
// =============================================================================

export async function getSettings(tenantId: string): Promise<SchedSettings | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('sched_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  return data ?? null;
}

export async function upsertSettings(
  payload: Partial<Omit<SchedSettings, 'created_at' | 'updated_at'>> & { tenant_id: string }
): Promise<SchedSettings> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_settings')
    .upsert(payload, { onConflict: 'tenant_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =============================================================================
// AGENDAMENTOS — via RPC
// =============================================================================

export interface FindSlotsParams {
  tenant_id: string;
  service_ids: string[];
  date_from: string;
  date_to: string;
  unit_id?: string | null;
  preferred_resource_id?: string | null;
  allow_any_resource?: boolean;
  time_from?: string | null;
  time_to?: string | null;
  limit?: number;
}

export async function findSlots(params: FindSlotsParams): Promise<FindSlotsResult> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('sched_find_slots', {
    p_tenant_id:             params.tenant_id,
    p_service_ids:           params.service_ids,
    p_date_from:             params.date_from,
    p_date_to:               params.date_to,
    p_unit_id:               params.unit_id ?? null,
    p_preferred_resource_id: params.preferred_resource_id ?? null,
    p_allow_any_resource:    params.allow_any_resource ?? true,
    p_time_from:             params.time_from ?? null,
    p_time_to:               params.time_to ?? null,
    p_limit:                 params.limit ?? 20,
  });

  if (error) throw error;
  return data as FindSlotsResult;
}

export interface GetAgendaParams {
  tenant_id: string;
  date: string;
  unit_id?: string | null;
  resource_id?: string | null;
  service_id?: string | null;
  statuses?: AppointmentStatus[];
}

export async function getAgenda(params: GetAgendaParams): Promise<GetAgendaResult> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('sched_get_agenda', {
    p_tenant_id:  params.tenant_id,
    p_date:       params.date,
    p_unit_id:    params.unit_id ?? null,
    p_resource_id: params.resource_id ?? null,
    p_service_id: params.service_id ?? null,
    p_statuses:   params.statuses ?? ['pending', 'confirmed'],
  });

  if (error) throw error;
  return data as GetAgendaResult;
}

export interface HoldAppointmentParams {
  tenant_id: string;
  contact_id: string;
  service_ids: string[];
  start_at: string;
  unit_id?: string | null;
  preferred_resource_id?: string | null;
  source?: 'manual' | 'ai' | 'api';
  hold_minutes?: number | null;
  created_by_user_id?: string | null;
  notes?: string | null;
}

export async function holdAppointment(params: HoldAppointmentParams): Promise<HoldAppointmentResult> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('sched_hold_appointment', {
    p_tenant_id:             params.tenant_id,
    p_contact_id:            params.contact_id,
    p_service_ids:           params.service_ids,
    p_start_at:              params.start_at,
    p_unit_id:               params.unit_id ?? null,
    p_preferred_resource_id: params.preferred_resource_id ?? null,
    p_source:                params.source ?? 'manual',
    p_hold_minutes:          params.hold_minutes ?? null,
    p_created_by_user_id:    params.created_by_user_id ?? null,
    p_notes:                 params.notes ?? null,
  });

  if (error) throw error;
  return data as HoldAppointmentResult;
}

export async function confirmAppointment(
  appointmentId: string,
  notes?: string | null
): Promise<ConfirmAppointmentResult> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('sched_confirm_appointment', {
    p_appointment_id: appointmentId,
    p_notes:          notes ?? null,
  });

  if (error) throw error;
  return data as ConfirmAppointmentResult;
}

export async function cancelAppointment(
  appointmentId: string,
  reason?: string | null
): Promise<CancelAppointmentResult> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('sched_cancel_appointment', {
    p_appointment_id: appointmentId,
    p_reason:         reason ?? null,
  });

  if (error) throw error;
  return data as CancelAppointmentResult;
}

export async function rescheduleAppointment(
  appointmentId: string,
  newStartAt: string,
  preferredResourceId?: string | null,
  holdMinutes?: number | null
): Promise<HoldAppointmentResult> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('sched_reschedule_appointment', {
    p_appointment_id:        appointmentId,
    p_new_start_at:          newStartAt,
    p_preferred_resource_id: preferredResourceId ?? null,
    p_hold_minutes:          holdMinutes ?? null,
  });

  if (error) throw error;
  return data as HoldAppointmentResult;
}

export async function expireHolds(tenantId?: string | null): Promise<{ expired_count: number }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('sched_expire_holds', {
    p_tenant_id: tenantId ?? null,
  });

  if (error) throw error;
  return data as { expired_count: number };
}

// =============================================================================
// LISTAGEM DE AGENDAMENTOS (UI)
// =============================================================================

export interface GetAppointmentsFilters {
  status?: AppointmentStatus | AppointmentStatus[];
  from?: string;
  to?: string;
  unit_id?: string;
  resource_id?: string;
  limit?: number;
  offset?: number;
}

export async function getAppointments(
  tenantId: string,
  filters: GetAppointmentsFilters = {}
): Promise<{ data: AppointmentWithDetails[]; count: number }> {
  const supabase = await createClient();

  const limit  = filters.limit  ?? 50;
  const offset = filters.offset ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('sched_appointments')
    .select(
      `*,
       contact:contacts(id, name, phone),
       unit:sched_units(id, name),
       sched_appointment_services(
         service_id,
         sched_services(id, name, duration_minutes)
       ),
       sched_appointment_resource_allocations(
         resource_id,
         sched_resources(id, name, resource_type)
       )`,
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .order('start_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in('status', statuses);
  }
  if (filters.from)      query = query.gte('start_at', filters.from);
  if (filters.to)        query = query.lte('start_at', filters.to);
  if (filters.unit_id)   query = query.eq('unit_id', filters.unit_id);

  const { data, error, count } = await query;
  if (error) throw error;

  // Normaliza o formato aninhado para AppointmentWithDetails
  const normalized: AppointmentWithDetails[] = (data ?? []).map((appt: Record<string, unknown>) => ({
    ...appt,
    services: ((appt.sched_appointment_services as Array<Record<string, unknown>>) ?? []).map(
      (s) => (s.sched_services as Record<string, unknown>)
    ),
    resources: ((appt.sched_appointment_resource_allocations as Array<Record<string, unknown>>) ?? []).map(
      (a) => (a.sched_resources as Record<string, unknown>)
    ),
  }));

  return { data: normalized, count: count ?? 0 };
}

export async function getAppointmentById(
  id: string,
  tenantId: string
): Promise<AppointmentWithDetails | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sched_appointments')
    .select(
      `*,
       contact:contacts(id, name, phone),
       unit:sched_units(id, name),
       sched_appointment_services(
         service_id,
         sched_services(id, name, duration_minutes)
       ),
       sched_appointment_resource_allocations(
         resource_id,
         sched_resources(id, name, resource_type)
       )`
    )
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) return null;

  return {
    ...data,
    services: (data.sched_appointment_services ?? []).map(
      (s: Record<string, unknown>) => s.sched_services
    ),
    resources: (data.sched_appointment_resource_allocations ?? []).map(
      (a: Record<string, unknown>) => a.sched_resources
    ),
  } as AppointmentWithDetails;
}
