-- =============================================================================
-- Feature: Módulo de Agendamentos (Scheduling)
-- =============================================================================
-- Módulo genérico e multi-nicho para agendamento de clientes:
-- Odonto / Médico / Estética / ISP / Laboratório / etc.
--
-- Conceitos-chave:
--   - Recurso: qualquer coisa que "bloqueia horário" (staff, sala, equipe, etc.)
--   - Serviço: o que será agendado, com duração e buffers
--   - Anti-overbooking: constraint GIST em sched_appointment_resource_allocations
--   - Hold: reserva temporária com expiração (chamada de n8n a cada 5min)
-- =============================================================================

-- Extensão necessária para constraint de exclusão por sobreposição de intervalo
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------------

-- Unidades / Locais / Filiais
CREATE TABLE IF NOT EXISTS public.sched_units (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  address_json jsonb       NOT NULL DEFAULT '{}'::jsonb,
  timezone     text        NOT NULL DEFAULT 'America/Fortaleza',
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sched_units_pkey PRIMARY KEY (id)
);

-- Recursos: profissionais, salas, equipamentos, veículos, equipes
CREATE TABLE IF NOT EXISTS public.sched_resources (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id       uuid        REFERENCES public.sched_units(id) ON DELETE SET NULL,
  resource_type text        NOT NULL,
  name          text        NOT NULL,
  user_id       uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sched_resources_pkey        PRIMARY KEY (id),
  CONSTRAINT sched_resources_type_check  CHECK (resource_type IN ('staff','room','equipment','vehicle','team'))
);

-- Serviços agendáveis
CREATE TABLE IF NOT EXISTS public.sched_services (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                  text        NOT NULL,
  service_type          text        NOT NULL DEFAULT 'generic',
  description           text,
  duration_minutes      int         NOT NULL,
  buffer_before_minutes int         NOT NULL DEFAULT 0,
  buffer_after_minutes  int         NOT NULL DEFAULT 0,
  price_cents           int,
  is_active             boolean     NOT NULL DEFAULT true,
  metadata              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sched_services_pkey            PRIMARY KEY (id),
  CONSTRAINT sched_services_duration_check  CHECK (duration_minutes > 0),
  CONSTRAINT sched_services_buf_before      CHECK (buffer_before_minutes >= 0),
  CONSTRAINT sched_services_buf_after       CHECK (buffer_after_minutes >= 0)
);

-- Requisitos de recurso por serviço (ex: serviço exige staff + room)
CREATE TABLE IF NOT EXISTS public.sched_service_resource_requirements (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_id            uuid        NOT NULL REFERENCES public.sched_services(id) ON DELETE CASCADE,
  required_resource_type text       NOT NULL,
  quantity              int         NOT NULL DEFAULT 1,
  is_mandatory          boolean     NOT NULL DEFAULT true,
  preferred_unit_id     uuid        REFERENCES public.sched_units(id) ON DELETE SET NULL,
  metadata              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sched_srv_req_pkey         PRIMARY KEY (id),
  CONSTRAINT sched_srv_req_type_check   CHECK (required_resource_type IN ('staff','room','equipment','vehicle','team')),
  CONSTRAINT sched_srv_req_qty_check    CHECK (quantity > 0)
);

-- Disponibilidade recorrente por dia da semana (por recurso)
CREATE TABLE IF NOT EXISTS public.sched_availability_windows (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_id uuid        NOT NULL REFERENCES public.sched_resources(id) ON DELETE CASCADE,
  day_of_week int         NOT NULL,
  start_time  time        NOT NULL,
  end_time    time        NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sched_avail_win_pkey       PRIMARY KEY (id),
  CONSTRAINT sched_avail_win_dow_check  CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT sched_avail_win_time_check CHECK (end_time > start_time)
);

-- Exceções / bloqueios / aberturas extras (feriados, folgas, horas extras)
CREATE TABLE IF NOT EXISTS public.sched_availability_exceptions (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_id    uuid        REFERENCES public.sched_resources(id) ON DELETE CASCADE,
  unit_id        uuid        REFERENCES public.sched_units(id) ON DELETE CASCADE,
  exception_type text        NOT NULL,
  start_at       timestamptz NOT NULL,
  end_at         timestamptz NOT NULL,
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sched_avail_exc_pkey        PRIMARY KEY (id),
  CONSTRAINT sched_avail_exc_type_check  CHECK (exception_type IN ('block','extra_open')),
  CONSTRAINT sched_avail_exc_range_check CHECK (end_at > start_at)
);

-- Configurações do tenant (1 linha por tenant, upsert)
CREATE TABLE IF NOT EXISTS public.sched_settings (
  tenant_id                          uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  allow_customer_choose_professional boolean NOT NULL DEFAULT true,
  allow_any_available_professional   boolean NOT NULL DEFAULT true,
  min_notice_minutes                 int     NOT NULL DEFAULT 60,
  max_booking_window_days            int     NOT NULL DEFAULT 60,
  slot_granularity_minutes           int     NOT NULL DEFAULT 10,
  hold_duration_minutes              int     NOT NULL DEFAULT 10,
  availability_mode                  text    NOT NULL DEFAULT 'hybrid',
  automation_config                  jsonb   NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sched_settings_pkey          PRIMARY KEY (tenant_id),
  CONSTRAINT sched_settings_notice_check  CHECK (min_notice_minutes >= 0),
  CONSTRAINT sched_settings_window_check  CHECK (max_booking_window_days > 0),
  CONSTRAINT sched_settings_slot_check    CHECK (slot_granularity_minutes > 0),
  CONSTRAINT sched_settings_hold_check    CHECK (hold_duration_minutes > 0),
  CONSTRAINT sched_settings_mode_check    CHECK (availability_mode IN ('recurring','open_with_blocks','hybrid'))
);

-- Agendamentos
CREATE TABLE IF NOT EXISTS public.sched_appointments (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id          uuid        NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  unit_id             uuid        REFERENCES public.sched_units(id) ON DELETE SET NULL,
  channel_id          uuid        REFERENCES public.channels(id) ON DELETE SET NULL,
  start_at            timestamptz NOT NULL,
  end_at              timestamptz NOT NULL,
  hold_expires_at     timestamptz,
  status              text        NOT NULL DEFAULT 'pending',
  source              text        NOT NULL DEFAULT 'manual',
  notes               text,
  created_by_user_id  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sched_appointments_pkey         PRIMARY KEY (id),
  CONSTRAINT sched_appointments_range_check  CHECK (end_at > start_at),
  CONSTRAINT sched_appointments_status_check CHECK (status IN ('held','pending','confirmed','canceled','completed','no_show')),
  CONSTRAINT sched_appointments_source_check CHECK (source IN ('manual','ai','api'))
);

-- Serviços do agendamento (multi-serviço)
CREATE TABLE IF NOT EXISTS public.sched_appointment_services (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  appointment_id uuid        NOT NULL REFERENCES public.sched_appointments(id) ON DELETE CASCADE,
  service_id     uuid        NOT NULL REFERENCES public.sched_services(id) ON DELETE RESTRICT,
  quantity       int         NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sched_appt_services_pkey      PRIMARY KEY (id),
  CONSTRAINT sched_appt_services_qty_check CHECK (quantity > 0)
);

-- Alocações de recursos — anti-overbooking via constraint GIST
CREATE TABLE IF NOT EXISTS public.sched_appointment_resource_allocations (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id uuid        NOT NULL REFERENCES public.sched_appointments(id) ON DELETE CASCADE,
  resource_id    uuid        NOT NULL REFERENCES public.sched_resources(id) ON DELETE CASCADE,
  start_at       timestamptz NOT NULL,
  end_at         timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sched_alloc_pkey        PRIMARY KEY (id),
  CONSTRAINT sched_alloc_range_check CHECK (end_at > start_at),
  -- Anti-overbooking: impede sobreposição de intervalo para o mesmo recurso
  CONSTRAINT sched_alloc_no_overlap  EXCLUDE USING GIST (
    resource_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
);

-- Vínculo entre entidades e KBs (bases de conhecimento)
CREATE TABLE IF NOT EXISTS public.knowledge_entity_links (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type           text        NOT NULL,
  entity_id             uuid        NOT NULL,
  base_conhecimento_id  uuid        NOT NULL REFERENCES public.base_conhecimentos(id) ON DELETE CASCADE,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT knowledge_entity_links_pkey        PRIMARY KEY (id),
  CONSTRAINT knowledge_entity_links_type_check  CHECK (entity_type IN ('service','resource','unit','setting','appointment')),
  CONSTRAINT knowledge_entity_links_unique       UNIQUE (entity_type, entity_id, base_conhecimento_id)
);

-- ---------------------------------------------------------------------------
-- 2. ÍNDICES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS sched_units_tenant_idx
  ON public.sched_units (tenant_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS sched_resources_tenant_idx
  ON public.sched_resources (tenant_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS sched_resources_unit_idx
  ON public.sched_resources (unit_id);

CREATE INDEX IF NOT EXISTS sched_services_tenant_idx
  ON public.sched_services (tenant_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS sched_srv_req_service_idx
  ON public.sched_service_resource_requirements (service_id);

CREATE INDEX IF NOT EXISTS sched_avail_win_resource_idx
  ON public.sched_availability_windows (resource_id, day_of_week) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS sched_avail_exc_tenant_idx
  ON public.sched_availability_exceptions (tenant_id);

CREATE INDEX IF NOT EXISTS sched_avail_exc_resource_idx
  ON public.sched_availability_exceptions (resource_id);

CREATE INDEX IF NOT EXISTS sched_appt_tenant_status_idx
  ON public.sched_appointments (tenant_id, status);

CREATE INDEX IF NOT EXISTS sched_appt_start_idx
  ON public.sched_appointments (tenant_id, start_at);

CREATE INDEX IF NOT EXISTS sched_appt_services_appt_idx
  ON public.sched_appointment_services (appointment_id);

CREATE INDEX IF NOT EXISTS sched_alloc_resource_idx
  ON public.sched_appointment_resource_allocations (resource_id);

CREATE INDEX IF NOT EXISTS sched_alloc_appointment_idx
  ON public.sched_appointment_resource_allocations (appointment_id);

CREATE INDEX IF NOT EXISTS kel_entity_idx
  ON public.knowledge_entity_links (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS kel_base_idx
  ON public.knowledge_entity_links (base_conhecimento_id);

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS — updated_at automático
-- ---------------------------------------------------------------------------

-- set_updated_at() já existe (criada em 20260325_agent_schedule.sql)
-- Apenas criamos os triggers para as novas tabelas

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sched_units_updated_at') THEN
    CREATE TRIGGER trg_sched_units_updated_at
      BEFORE UPDATE ON public.sched_units
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sched_resources_updated_at') THEN
    CREATE TRIGGER trg_sched_resources_updated_at
      BEFORE UPDATE ON public.sched_resources
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sched_services_updated_at') THEN
    CREATE TRIGGER trg_sched_services_updated_at
      BEFORE UPDATE ON public.sched_services
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sched_appointments_updated_at') THEN
    CREATE TRIGGER trg_sched_appointments_updated_at
      BEFORE UPDATE ON public.sched_appointments
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sched_settings_updated_at') THEN
    CREATE TRIGGER trg_sched_settings_updated_at
      BEFORE UPDATE ON public.sched_settings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS — Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.sched_units                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_resources                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_services                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_service_resource_requirements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_availability_windows            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_availability_exceptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_settings                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_appointments                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_appointment_services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_appointment_resource_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entity_links                ENABLE ROW LEVEL SECURITY;

-- Política padrão: isolamento por tenant
CREATE POLICY sched_units_tenant_isolation
  ON public.sched_units FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY sched_resources_tenant_isolation
  ON public.sched_resources FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY sched_services_tenant_isolation
  ON public.sched_services FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY sched_srv_req_tenant_isolation
  ON public.sched_service_resource_requirements FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY sched_avail_win_tenant_isolation
  ON public.sched_availability_windows FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY sched_avail_exc_tenant_isolation
  ON public.sched_availability_exceptions FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY sched_settings_tenant_isolation
  ON public.sched_settings FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY sched_appointments_tenant_isolation
  ON public.sched_appointments FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY sched_appt_services_tenant_isolation
  ON public.sched_appointment_services FOR ALL
  USING (
    appointment_id IN (
      SELECT id FROM public.sched_appointments
      WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY sched_alloc_tenant_isolation
  ON public.sched_appointment_resource_allocations FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY knowledge_entity_links_tenant_isolation
  ON public.knowledge_entity_links FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Service role (n8n / cron) ignora RLS via SUPABASE_SERVICE_ROLE_KEY.

-- ---------------------------------------------------------------------------
-- 5. RPCs
-- ---------------------------------------------------------------------------

-- ----
-- 5.1 sched_get_settings: retorna configurações do tenant
-- ----
CREATE OR REPLACE FUNCTION public.sched_get_settings(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_settings record;
BEGIN
  SELECT * INTO v_settings
  FROM public.sched_settings
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    -- Retorna defaults se o tenant ainda não configurou
    RETURN jsonb_build_object(
      'tenant_id',                          p_tenant_id,
      'allow_customer_choose_professional', true,
      'allow_any_available_professional',   true,
      'min_notice_minutes',                 60,
      'max_booking_window_days',            60,
      'slot_granularity_minutes',           10,
      'hold_duration_minutes',              10,
      'availability_mode',                  'hybrid',
      'automation_config',                  '{}'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'tenant_id',                          v_settings.tenant_id,
    'allow_customer_choose_professional', v_settings.allow_customer_choose_professional,
    'allow_any_available_professional',   v_settings.allow_any_available_professional,
    'min_notice_minutes',                 v_settings.min_notice_minutes,
    'max_booking_window_days',            v_settings.max_booking_window_days,
    'slot_granularity_minutes',           v_settings.slot_granularity_minutes,
    'hold_duration_minutes',              v_settings.hold_duration_minutes,
    'availability_mode',                  v_settings.availability_mode,
    'automation_config',                  v_settings.automation_config
  );
END;
$$;

-- ----
-- 5.2 sched_search_services: busca serviços por nome (fuzzy)
-- ----
CREATE OR REPLACE FUNCTION public.sched_search_services(
  p_tenant_id uuid,
  p_query     text DEFAULT '',
  p_limit     int  DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_matches jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'service_id',            id,
      'name',                  name,
      'description',           description,
      'duration_minutes',      duration_minutes,
      'buffer_before_minutes', buffer_before_minutes,
      'buffer_after_minutes',  buffer_after_minutes,
      'price_cents',           price_cents
    )
    ORDER BY name
  )
  INTO v_matches
  FROM public.sched_services
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND (p_query = '' OR name ILIKE '%' || p_query || '%' OR description ILIKE '%' || p_query || '%')
  LIMIT p_limit;

  RETURN jsonb_build_object('matches', COALESCE(v_matches, '[]'::jsonb));
END;
$$;

-- ----
-- 5.3 sched_search_resources: busca recursos por nome/tipo
-- ----
CREATE OR REPLACE FUNCTION public.sched_search_resources(
  p_tenant_id     uuid,
  p_query         text    DEFAULT '',
  p_resource_type text    DEFAULT NULL,
  p_unit_id       uuid    DEFAULT NULL,
  p_limit         int     DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_matches jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'resource_id',   id,
      'name',          name,
      'resource_type', resource_type,
      'unit_id',       unit_id
    )
    ORDER BY name
  )
  INTO v_matches
  FROM public.sched_resources
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND (p_query = '' OR name ILIKE '%' || p_query || '%')
    AND (p_resource_type IS NULL OR resource_type = p_resource_type)
    AND (p_unit_id IS NULL OR unit_id = p_unit_id)
  LIMIT p_limit;

  RETURN jsonb_build_object('matches', COALESCE(v_matches, '[]'::jsonb));
END;
$$;

-- ----
-- 5.4 sched_find_slots: retorna horários disponíveis com recursos sugeridos
-- ----
CREATE OR REPLACE FUNCTION public.sched_find_slots(
  p_tenant_id            uuid,
  p_service_ids          uuid[],
  p_date_from            date,
  p_date_to              date,
  p_unit_id              uuid    DEFAULT NULL,
  p_preferred_resource_id uuid   DEFAULT NULL,
  p_allow_any_resource   boolean DEFAULT true,
  p_time_from            time    DEFAULT NULL,
  p_time_to              time    DEFAULT NULL,
  p_limit                int     DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_settings           record;
  v_total_duration     int := 0;
  v_buf_before         int := 0;
  v_buf_after          int := 0;
  v_slot_duration      int;
  v_granularity        int;
  v_min_notice         timestamptz;
  v_max_to             date;
  v_current_date       date;
  v_dow                int;
  v_slot_start         timestamptz;
  v_slot_end           timestamptz;
  v_alloc_start        timestamptz;
  v_alloc_end          timestamptz;
  v_window             record;
  v_resource           record;
  v_conflict           boolean;
  v_results            jsonb := '[]'::jsonb;
  v_result_count       int   := 0;
  v_allocations        jsonb;
  v_service            record;
  v_tz                 text  := 'America/Fortaleza';
BEGIN
  -- Busca configurações do tenant
  SELECT * INTO v_settings FROM public.sched_settings WHERE tenant_id = p_tenant_id;

  v_granularity := COALESCE(v_settings.slot_granularity_minutes, 10);
  v_min_notice  := now() + make_interval(mins => COALESCE(v_settings.min_notice_minutes, 60));
  v_max_to      := LEAST(p_date_to, (now() + make_interval(days => COALESCE(v_settings.max_booking_window_days, 60)))::date);

  -- Calcula duração total dos serviços + buffers
  FOR v_service IN
    SELECT duration_minutes, buffer_before_minutes, buffer_after_minutes
    FROM public.sched_services
    WHERE id = ANY(p_service_ids) AND tenant_id = p_tenant_id AND is_active = true
  LOOP
    v_total_duration := v_total_duration + v_service.duration_minutes;
    v_buf_before     := GREATEST(v_buf_before, v_service.buffer_before_minutes);
    v_buf_after      := GREATEST(v_buf_after, v_service.buffer_after_minutes);
  END LOOP;

  IF v_total_duration = 0 THEN
    RETURN jsonb_build_object('error', 'Nenhum serviço válido encontrado', 'results', '[]'::jsonb);
  END IF;

  v_slot_duration := v_buf_before + v_total_duration + v_buf_after;

  -- Itera sobre cada dia no intervalo
  v_current_date := GREATEST(p_date_from, now()::date);
  WHILE v_current_date <= v_max_to AND v_result_count < p_limit LOOP
    v_dow := EXTRACT(DOW FROM v_current_date)::int;

    -- Para cada recurso staff disponível neste dia
    FOR v_resource IN
      SELECT r.id, r.name, r.resource_type, r.unit_id
      FROM public.sched_resources r
      WHERE r.tenant_id = p_tenant_id
        AND r.is_active = true
        AND r.resource_type = 'staff'
        AND (p_unit_id IS NULL OR r.unit_id = p_unit_id)
        AND (p_preferred_resource_id IS NULL OR r.id = p_preferred_resource_id OR p_allow_any_resource = true)
    LOOP
      -- Para cada janela de disponibilidade do recurso neste dia
      FOR v_window IN
        SELECT start_time, end_time
        FROM public.sched_availability_windows
        WHERE resource_id = v_resource.id
          AND day_of_week = v_dow
          AND is_active = true
        ORDER BY start_time
      LOOP
        -- Itera slots dentro da janela com granularidade configurada
        v_slot_start := (v_current_date::text || ' ' || v_window.start_time::text)::timestamptz;
        WHILE v_slot_start + make_interval(mins => v_slot_duration) <=
              (v_current_date::text || ' ' || v_window.end_time::text)::timestamptz
          AND v_result_count < p_limit
        LOOP
          v_slot_end   := v_slot_start + make_interval(mins => v_slot_duration);
          v_alloc_start := v_slot_start - make_interval(mins => v_buf_before);
          v_alloc_end   := v_slot_start + make_interval(mins => v_total_duration) + make_interval(mins => v_buf_after);

          -- Filtra por time_from / time_to se fornecidos
          IF (p_time_from IS NULL OR v_slot_start::time >= p_time_from)
             AND (p_time_to IS NULL OR v_slot_start::time < p_time_to) THEN

            -- Verifica antecedência mínima
            IF v_slot_start >= v_min_notice THEN

              -- Verifica se não há bloqueio de exceção para este recurso
              SELECT EXISTS (
                SELECT 1 FROM public.sched_availability_exceptions
                WHERE (resource_id = v_resource.id OR unit_id = v_resource.unit_id)
                  AND exception_type = 'block'
                  AND start_at <= v_slot_end
                  AND end_at   >= v_slot_start
              ) INTO v_conflict;

              IF NOT v_conflict THEN
                -- Verifica conflito de alocação (anti-overbooking)
                SELECT EXISTS (
                  SELECT 1 FROM public.sched_appointment_resource_allocations a
                  JOIN public.sched_appointments appt ON appt.id = a.appointment_id
                  WHERE a.resource_id = v_resource.id
                    AND appt.status NOT IN ('canceled')
                    AND tstzrange(a.start_at, a.end_at, '[)') &&
                        tstzrange(v_alloc_start, v_alloc_end, '[)')
                ) INTO v_conflict;

                IF NOT v_conflict THEN
                  v_results := v_results || jsonb_build_object(
                    'start_at',             v_slot_start,
                    'end_at',               v_slot_end,
                    'unit_id',              v_resource.unit_id,
                    'slot_duration_minutes', v_slot_duration,
                    'suggested_allocations', jsonb_build_array(
                      jsonb_build_object(
                        'resource_id',   v_resource.id,
                        'resource_type', v_resource.resource_type,
                        'name',          v_resource.name
                      )
                    ),
                    'confidence', 'high'
                  );
                  v_result_count := v_result_count + 1;
                END IF;
              END IF;
            END IF;
          END IF;

          -- Avança para próximo slot
          v_slot_start := v_slot_start + make_interval(mins => v_granularity);
        END LOOP; -- slots
      END LOOP; -- janelas
    END LOOP; -- recursos

    v_current_date := v_current_date + 1;
  END LOOP; -- dias

  RETURN jsonb_build_object(
    'slot_duration_minutes', v_slot_duration,
    'explain', jsonb_build_object(
      'service_total_minutes',       v_total_duration,
      'buffer_before_minutes',       v_buf_before,
      'buffer_after_minutes',        v_buf_after,
      'min_notice_minutes_applied',  true,
      'max_window_applied',          true
    ),
    'results', v_results
  );
END;
$$;

-- ----
-- 5.5 sched_get_agenda: retorna agendamentos do dia (ocupados)
-- ----
CREATE OR REPLACE FUNCTION public.sched_get_agenda(
  p_tenant_id  uuid,
  p_date       date,
  p_unit_id    uuid    DEFAULT NULL,
  p_resource_id uuid   DEFAULT NULL,
  p_service_id  uuid   DEFAULT NULL,
  p_statuses    text[] DEFAULT ARRAY['pending','confirmed']
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_appointments jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'appointment_id', a.id,
      'start_at',       a.start_at,
      'end_at',         a.end_at,
      'status',         a.status,
      'notes',          a.notes,
      'contact', jsonb_build_object(
        'id',    c.id,
        'name',  c.name,
        'phone', c.phone_number
      ),
      'services', (
        SELECT jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name))
        FROM public.sched_appointment_services aps
        JOIN public.sched_services s ON s.id = aps.service_id
        WHERE aps.appointment_id = a.id
      ),
      'resources', (
        SELECT jsonb_agg(jsonb_build_object('resource_id', r.id, 'name', r.name, 'type', r.resource_type))
        FROM public.sched_appointment_resource_allocations al
        JOIN public.sched_resources r ON r.id = al.resource_id
        WHERE al.appointment_id = a.id
      )
    )
    ORDER BY a.start_at
  )
  INTO v_appointments
  FROM public.sched_appointments a
  JOIN public.contacts c ON c.id = a.contact_id
  WHERE a.tenant_id = p_tenant_id
    AND a.start_at::date = p_date
    AND a.status = ANY(p_statuses)
    AND (p_unit_id IS NULL OR a.unit_id = p_unit_id)
    AND (p_resource_id IS NULL OR EXISTS (
      SELECT 1 FROM public.sched_appointment_resource_allocations al
      WHERE al.appointment_id = a.id AND al.resource_id = p_resource_id
    ))
    AND (p_service_id IS NULL OR EXISTS (
      SELECT 1 FROM public.sched_appointment_services aps
      WHERE aps.appointment_id = a.id AND aps.service_id = p_service_id
    ));

  RETURN jsonb_build_object(
    'date',         p_date,
    'appointments', COALESCE(v_appointments, '[]'::jsonb)
  );
END;
$$;

-- ----
-- 5.6 sched_hold_appointment: reserva horário por X minutos
-- ----
CREATE OR REPLACE FUNCTION public.sched_hold_appointment(
  p_tenant_id              uuid,
  p_contact_id             uuid,
  p_service_ids            uuid[],
  p_start_at               timestamptz,
  p_unit_id                uuid    DEFAULT NULL,
  p_preferred_resource_id  uuid    DEFAULT NULL,
  p_source                 text    DEFAULT 'manual',
  p_hold_minutes           int     DEFAULT NULL,
  p_created_by_user_id     uuid    DEFAULT NULL,
  p_notes                  text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings         record;
  v_hold_minutes     int;
  v_total_duration   int := 0;
  v_buf_before       int := 0;
  v_buf_after        int := 0;
  v_end_at           timestamptz;
  v_alloc_start      timestamptz;
  v_alloc_end        timestamptz;
  v_appointment_id   uuid;
  v_hold_expires_at  timestamptz;
  v_resource         record;
  v_service          record;
  v_allocations      jsonb := '[]'::jsonb;
BEGIN
  -- Busca configurações
  SELECT * INTO v_settings FROM public.sched_settings WHERE tenant_id = p_tenant_id;
  v_hold_minutes := COALESCE(p_hold_minutes, v_settings.hold_duration_minutes, 10);

  -- Calcula duração total
  FOR v_service IN
    SELECT duration_minutes, buffer_before_minutes, buffer_after_minutes
    FROM public.sched_services
    WHERE id = ANY(p_service_ids) AND tenant_id = p_tenant_id AND is_active = true
  LOOP
    v_total_duration := v_total_duration + v_service.duration_minutes;
    v_buf_before     := GREATEST(v_buf_before, v_service.buffer_before_minutes);
    v_buf_after      := GREATEST(v_buf_after, v_service.buffer_after_minutes);
  END LOOP;

  IF v_total_duration = 0 THEN
    RETURN jsonb_build_object('error', 'Nenhum serviço válido para hold');
  END IF;

  v_end_at          := p_start_at + make_interval(mins => v_total_duration);
  v_alloc_start     := p_start_at - make_interval(mins => v_buf_before);
  v_alloc_end       := v_end_at   + make_interval(mins => v_buf_after);
  v_hold_expires_at := now() + make_interval(mins => v_hold_minutes);

  -- Cria o agendamento com status 'held'
  INSERT INTO public.sched_appointments (
    tenant_id, contact_id, unit_id, start_at, end_at,
    hold_expires_at, status, source, notes, created_by_user_id
  )
  VALUES (
    p_tenant_id, p_contact_id, p_unit_id, p_start_at, v_end_at,
    v_hold_expires_at, 'held', p_source, p_notes, p_created_by_user_id
  )
  RETURNING id INTO v_appointment_id;

  -- Registra os serviços do agendamento
  INSERT INTO public.sched_appointment_services (appointment_id, service_id)
  SELECT v_appointment_id, unnest(p_service_ids);

  -- Aloca o recurso preferido (ou primeiro staff disponível)
  IF p_preferred_resource_id IS NOT NULL THEN
    SELECT id, name, resource_type INTO v_resource
    FROM public.sched_resources
    WHERE id = p_preferred_resource_id AND tenant_id = p_tenant_id AND is_active = true;

    IF FOUND THEN
      INSERT INTO public.sched_appointment_resource_allocations (
        tenant_id, appointment_id, resource_id, start_at, end_at
      )
      VALUES (p_tenant_id, v_appointment_id, v_resource.id, v_alloc_start, v_alloc_end);

      v_allocations := v_allocations || jsonb_build_object(
        'resource_id', v_resource.id,
        'start_at',    v_alloc_start,
        'end_at',      v_alloc_end
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'appointment_id',  v_appointment_id,
    'status',          'held',
    'hold_expires_at', v_hold_expires_at,
    'start_at',        p_start_at,
    'end_at',          v_end_at,
    'allocations',     v_allocations
  );

EXCEPTION
  WHEN exclusion_violation THEN
    -- A constraint GIST detectou sobreposição de recursos
    RETURN jsonb_build_object('error', 'Horário não disponível — conflito de agendamento detectado');
END;
$$;

-- ----
-- 5.7 sched_confirm_appointment: confirma agendamento (held ou pending → confirmed)
-- ----
CREATE OR REPLACE FUNCTION public.sched_confirm_appointment(
  p_appointment_id uuid,
  p_notes          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appt record;
BEGIN
  UPDATE public.sched_appointments
  SET status     = 'confirmed',
      notes      = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_appointment_id
    AND status IN ('held', 'pending')
  RETURNING * INTO v_appt;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Agendamento não encontrado ou status inválido para confirmação');
  END IF;

  RETURN jsonb_build_object(
    'appointment_id', v_appt.id,
    'status',         'confirmed',
    'start_at',       v_appt.start_at,
    'end_at',         v_appt.end_at,
    'n8n_events', jsonb_build_array(
      jsonb_build_object('event', 'scheduling.appointment.confirmed', 'status', 'queued')
    )
  );
END;
$$;

-- ----
-- 5.8 sched_cancel_appointment: cancela e libera alocações
-- ----
CREATE OR REPLACE FUNCTION public.sched_cancel_appointment(
  p_appointment_id uuid,
  p_reason         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Libera alocações de recursos
  DELETE FROM public.sched_appointment_resource_allocations
  WHERE appointment_id = p_appointment_id;

  -- Cancela o agendamento
  UPDATE public.sched_appointments
  SET status     = 'canceled',
      notes      = CASE WHEN p_reason IS NOT NULL
                        THEN COALESCE(notes || ' | ', '') || 'Cancelado: ' || p_reason
                        ELSE notes END,
      updated_at = now()
  WHERE id = p_appointment_id
    AND status NOT IN ('canceled', 'completed');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Agendamento não encontrado ou já finalizado');
  END IF;

  RETURN jsonb_build_object(
    'appointment_id', p_appointment_id,
    'status',         'canceled'
  );
END;
$$;

-- ----
-- 5.9 sched_reschedule_appointment: cancela e faz novo hold atomicamente
-- ----
CREATE OR REPLACE FUNCTION public.sched_reschedule_appointment(
  p_appointment_id         uuid,
  p_new_start_at           timestamptz,
  p_preferred_resource_id  uuid  DEFAULT NULL,
  p_hold_minutes           int   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appt         record;
  v_service_ids  uuid[];
  v_hold_result  jsonb;
BEGIN
  -- Busca dados do agendamento original
  SELECT * INTO v_appt
  FROM public.sched_appointments
  WHERE id = p_appointment_id
    AND status NOT IN ('canceled', 'completed');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Agendamento não encontrado ou já finalizado');
  END IF;

  -- Busca serviços do agendamento original
  SELECT array_agg(service_id) INTO v_service_ids
  FROM public.sched_appointment_services
  WHERE appointment_id = p_appointment_id;

  -- Cancela o agendamento original (libera alocações)
  PERFORM public.sched_cancel_appointment(p_appointment_id, 'reagendado');

  -- Cria novo hold no novo horário
  v_hold_result := public.sched_hold_appointment(
    p_tenant_id             => v_appt.tenant_id,
    p_contact_id            => v_appt.contact_id,
    p_service_ids           => v_service_ids,
    p_start_at              => p_new_start_at,
    p_unit_id               => v_appt.unit_id,
    p_preferred_resource_id => p_preferred_resource_id,
    p_source                => v_appt.source,
    p_hold_minutes          => p_hold_minutes,
    p_created_by_user_id    => v_appt.created_by_user_id,
    p_notes                 => v_appt.notes
  );

  RETURN v_hold_result;
END;
$$;

-- ----
-- 5.10 sched_expire_holds: expira holds vencidos (chamado por n8n a cada 5min)
-- ----
CREATE OR REPLACE FUNCTION public.sched_expire_holds(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_ids  uuid[];
  v_expired_count int;
BEGIN
  -- Coleta IDs dos holds expirados
  SELECT array_agg(id) INTO v_expired_ids
  FROM public.sched_appointments
  WHERE status = 'held'
    AND hold_expires_at < now()
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  IF v_expired_ids IS NULL OR array_length(v_expired_ids, 1) = 0 THEN
    RETURN jsonb_build_object('expired_count', 0);
  END IF;

  -- Remove alocações dos holds expirados
  DELETE FROM public.sched_appointment_resource_allocations
  WHERE appointment_id = ANY(v_expired_ids);

  -- Marca os agendamentos como cancelados
  UPDATE public.sched_appointments
  SET status     = 'canceled',
      notes      = COALESCE(notes || ' | ', '') || 'Hold expirado automaticamente',
      updated_at = now()
  WHERE id = ANY(v_expired_ids);

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RETURN jsonb_build_object('expired_count', v_expired_count);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. COMENTÁRIOS
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.sched_units IS
  'Unidades/locais/filiais disponíveis para agendamento por tenant.';

COMMENT ON TABLE public.sched_resources IS
  'Recursos que "bloqueiam horário": staff, sala, equipamento, veículo, equipe. '
  'Coração do módulo — qualquer combinação de resource_type torna o módulo multi-nicho.';

COMMENT ON TABLE public.sched_services IS
  'Serviços agendáveis com duração e buffers antes/depois.';

COMMENT ON TABLE public.sched_appointment_resource_allocations IS
  'Alocações de recursos por agendamento. '
  'Constraint GIST (sched_alloc_no_overlap) garante anti-overbooking a nível de banco.';

COMMENT ON TABLE public.sched_settings IS
  'Configurações de agendamento por tenant (1 linha por tenant via upsert). '
  'Controla: antecedência mínima, janela máxima, granularidade de slots, duração de hold.';

COMMENT ON FUNCTION public.sched_find_slots IS
  'RPC principal de disponibilidade. Retorna slots livres com recursos sugeridos. '
  'Chamada pela IA e pelo painel manual.';

COMMENT ON FUNCTION public.sched_hold_appointment IS
  'Reserva um horário por N minutos (anti-overbooking via GIST). '
  'Em caso de conflito, retorna erro em vez de lançar exceção.';

COMMENT ON FUNCTION public.sched_expire_holds IS
  'Expira holds vencidos e libera alocações. '
  'Chamada pelo n8n via /api/agendamentos/expire-holds a cada 5 minutos.';
