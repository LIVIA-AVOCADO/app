-- =============================================================================
-- Feature: Horários do Agente de IA
-- =============================================================================
-- Permite que cada tenant configure janelas de horário em que o agente de IA
-- estará online. Fora do horário configurado, o sistema faz transbordo para
-- humano e envia uma mensagem configurável.
--
-- Exceção 24/7: se o tenant não tiver nenhum registro em agent_schedule_weekly,
-- a função is_agent_online() retorna TRUE sem nenhuma consulta adicional.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------------

-- Horários recorrentes por dia da semana.
-- Suporta múltiplos intervalos no mesmo dia (ex: pausa para almoço).
CREATE TABLE IF NOT EXISTS public.agent_schedule_weekly (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  day_of_week     smallint    NOT NULL,  -- 0=domingo … 6=sábado
  start_time      time        NOT NULL,
  end_time        time        NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  offline_message text,                  -- NULL → usa mensagem padrão do sistema
  timezone        text        NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agent_schedule_weekly_pkey           PRIMARY KEY (id),
  CONSTRAINT agent_schedule_weekly_dow_range      CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT agent_schedule_weekly_time_range     CHECK (end_time > start_time),
  CONSTRAINT agent_schedule_weekly_unique_slot    UNIQUE (tenant_id, day_of_week, start_time)
);

-- Datas específicas que substituem ou bloqueiam o horário semanal.
-- type = 'blocked' → dia inteiro offline (feriado).
-- type = 'custom'  → horário diferente do padrão (substitui weekly nesta data).
CREATE TABLE IF NOT EXISTS public.agent_schedule_exceptions (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  exception_date  date        NOT NULL,
  type            text        NOT NULL,
  start_time      time,                  -- NULL quando type = 'blocked'
  end_time        time,                  -- NULL quando type = 'blocked'
  label           text,                  -- ex: "Natal", "Recesso de julho"
  timezone        text        NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agent_schedule_exceptions_pkey         PRIMARY KEY (id),
  CONSTRAINT agent_schedule_exceptions_type_check   CHECK (type IN ('blocked', 'custom')),
  CONSTRAINT agent_schedule_exceptions_custom_times CHECK (
    type = 'blocked'
    OR (start_time IS NOT NULL AND end_time IS NOT NULL)
  ),
  CONSTRAINT agent_schedule_exceptions_custom_range CHECK (
    type = 'blocked'
    OR end_time > start_time
  ),
  CONSTRAINT agent_schedule_exceptions_unique_slot  UNIQUE (tenant_id, exception_date, COALESCE(start_time, '00:00:00'))
);

-- ---------------------------------------------------------------------------
-- 2. ÍNDICES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_agent_schedule_weekly_tenant
  ON public.agent_schedule_weekly (tenant_id, day_of_week)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_agent_schedule_exceptions_tenant_date
  ON public.agent_schedule_exceptions (tenant_id, exception_date);

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS — updated_at automático
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_agent_schedule_weekly_updated_at'
  ) THEN
    CREATE TRIGGER trg_agent_schedule_weekly_updated_at
      BEFORE UPDATE ON public.agent_schedule_weekly
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_agent_schedule_exceptions_updated_at'
  ) THEN
    CREATE TRIGGER trg_agent_schedule_exceptions_updated_at
      BEFORE UPDATE ON public.agent_schedule_exceptions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS — Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.agent_schedule_weekly    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_schedule_exceptions ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados veem/editam apenas dados do próprio tenant.
CREATE POLICY agent_schedule_weekly_tenant_isolation
  ON public.agent_schedule_weekly
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY agent_schedule_exceptions_tenant_isolation
  ON public.agent_schedule_exceptions
  FOR ALL
  USING (
    tenant_id = (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Service role (n8n / cron) ignora RLS automaticamente via SUPABASE_SERVICE_ROLE_KEY.

-- ---------------------------------------------------------------------------
-- 5. RPC: is_agent_online
-- ---------------------------------------------------------------------------
-- Retorna TRUE se o agente deve estar online agora para o tenant informado.
--
-- Prioridade de avaliação:
--   1. Sem configuração alguma  → TRUE  (24/7, sem overhead)
--   2. Exceção 'blocked' hoje   → FALSE
--   3. Exceção 'custom' hoje    → verifica os intervalos custom
--   4. Horário semanal          → verifica os intervalos do dia da semana
--
-- Retorna também a offline_message do intervalo semanal vigente (se houver),
-- pois o chamador (n8n via /api/agent-schedule/is-online) precisa dela.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_agent_online(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_timezone         text;
  v_now_local        timestamptz;
  v_now_time         time;
  v_today            date;
  v_dow              smallint;
  v_has_schedule     boolean;
  v_exception        record;
  v_interval         record;
  v_offline_msg      text;
BEGIN
  -- 1. Verifica se o tenant tem alguma configuração de horário.
  SELECT EXISTS (
    SELECT 1 FROM public.agent_schedule_weekly
    WHERE tenant_id = p_tenant_id AND is_active = true
    LIMIT 1
  ) INTO v_has_schedule;

  IF NOT v_has_schedule THEN
    -- Sem configuração = 24/7, sem custo adicional.
    RETURN jsonb_build_object('online', true, 'reason', '24_7');
  END IF;

  -- 2. Determina timezone do tenant (primeiro registro encontrado).
  SELECT timezone INTO v_timezone
  FROM public.agent_schedule_weekly
  WHERE tenant_id = p_tenant_id AND is_active = true
  LIMIT 1;

  v_timezone  := COALESCE(v_timezone, 'America/Sao_Paulo');
  v_now_local := now() AT TIME ZONE v_timezone;
  v_today     := v_now_local::date;
  v_now_time  := v_now_local::time;
  v_dow       := EXTRACT(DOW FROM v_now_local)::smallint; -- 0=dom, 6=sab

  -- 3. Verifica exceções para hoje.
  SELECT * INTO v_exception
  FROM public.agent_schedule_exceptions
  WHERE tenant_id = p_tenant_id
    AND exception_date = v_today
  LIMIT 1;

  IF FOUND THEN
    IF v_exception.type = 'blocked' THEN
      RETURN jsonb_build_object(
        'online',          false,
        'reason',          'exception_blocked',
        'offline_message', NULL
      );
    END IF;

    -- type = 'custom': verifica se agora está dentro do intervalo custom.
    IF v_exception.type = 'custom'
       AND v_now_time >= v_exception.start_time
       AND v_now_time <  v_exception.end_time
    THEN
      RETURN jsonb_build_object('online', true, 'reason', 'exception_custom');
    ELSE
      RETURN jsonb_build_object(
        'online',          false,
        'reason',          'exception_custom_outside',
        'offline_message', NULL
      );
    END IF;
  END IF;

  -- 4. Verifica horário semanal para o dia de hoje.
  FOR v_interval IN
    SELECT start_time, end_time, offline_message
    FROM public.agent_schedule_weekly
    WHERE tenant_id  = p_tenant_id
      AND day_of_week = v_dow
      AND is_active   = true
    ORDER BY start_time
  LOOP
    IF v_now_time >= v_interval.start_time
       AND v_now_time < v_interval.end_time
    THEN
      RETURN jsonb_build_object('online', true, 'reason', 'weekly_schedule');
    END IF;
    -- Guarda a mensagem do último intervalo como fallback (mais representativa).
    v_offline_msg := v_interval.offline_message;
  END LOOP;

  -- Fora de todos os intervalos do dia (ou dia sem intervalos configurados).
  RETURN jsonb_build_object(
    'online',          false,
    'reason',          'outside_schedule',
    'offline_message', v_offline_msg
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC: handle_agent_schedule_transitions
-- ---------------------------------------------------------------------------
-- Chamado pelo pg_cron a cada 5 minutos.
-- Para cada tenant cujo agente passou a estar offline, encerra o ia_active
-- de conversas abertas e registra o motivo.
-- A notificação ao n8n (transbordo) fica a cargo do workflow n8n já existente,
-- que é acionado quando detecta ia_active = false + pause_notes com sufixo
-- '[schedule]'. Isso reutiliza o padrão já estabelecido no projeto.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_agent_schedule_transitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant    record;
  v_result    jsonb;
BEGIN
  -- Itera sobre tenants que possuem configuração de horário.
  FOR v_tenant IN
    SELECT DISTINCT tenant_id
    FROM public.agent_schedule_weekly
    WHERE is_active = true
  LOOP
    -- Verifica se o agente está offline agora para este tenant.
    SELECT public.is_agent_online(v_tenant.tenant_id) INTO v_result;

    IF (v_result->>'online')::boolean = false THEN
      -- Pausa IA em todas as conversas abertas do tenant que ainda estão com ia_active = true.
      UPDATE public.conversations
      SET
        ia_active   = false,
        pause_notes = 'IA pausada automaticamente por horário [schedule]',
        updated_at  = now()
      WHERE
        tenant_id = v_tenant.tenant_id
        AND status    = 'open'
        AND ia_active = true;
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. pg_cron — executa a cada 5 minutos
-- ---------------------------------------------------------------------------
-- Requer extensão pg_cron habilitada no Supabase (Dashboard → Database → Extensions).
-- ---------------------------------------------------------------------------

SELECT cron.schedule(
  'agent-schedule-transitions',   -- nome único do job
  '*/5 * * * *',                  -- a cada 5 minutos
  $$SELECT public.handle_agent_schedule_transitions()$$
);

-- ---------------------------------------------------------------------------
-- 8. COMENTÁRIOS
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.agent_schedule_weekly IS
  'Horários recorrentes por dia da semana em que o agente de IA está online. '
  'Múltiplos registros por dia = múltiplos intervalos (ex: pausa para almoço). '
  'Ausência de registros para um tenant = modo 24/7 (sem consulta).';

COMMENT ON TABLE public.agent_schedule_exceptions IS
  'Exceções pontuais ao horário semanal: feriados (blocked) ou horários '
  'personalizados para uma data específica (custom).';

COMMENT ON FUNCTION public.is_agent_online(uuid) IS
  'Retorna JSON {online, reason, offline_message?}. '
  'Chamada pelo endpoint /api/agent-schedule/is-online consultado pelo n8n '
  'antes de processar cada mensagem recebida.';

COMMENT ON FUNCTION public.handle_agent_schedule_transitions() IS
  'Executada pelo pg_cron a cada 5 minutos. '
  'Pausa ia_active em conversas abertas de tenants cujo horário encerrou.';
