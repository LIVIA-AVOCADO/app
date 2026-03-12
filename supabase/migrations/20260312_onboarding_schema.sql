-- ============================================================
-- Migration: Onboarding Schema
-- Sprint 0 — Fundação do módulo de onboarding LIVIA
-- Tabelas, RLS, Realtime, Indexes e RPCs
-- ============================================================

-- ============================================================
-- 1. SCHEMA
-- ============================================================
CREATE SCHEMA IF NOT EXISTS onboarding;

-- ============================================================
-- 2. TABELAS
-- ============================================================

-- 2.1 Templates por nicho
CREATE TABLE IF NOT EXISTS onboarding.onboarding_templates (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text        NOT NULL,
  niche                text        NOT NULL,
  description          text,
  default_neurocore_id uuid        NOT NULL REFERENCES public.neurocores(id),
  wizard_schema        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  default_payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  activation_rules     jsonb       NOT NULL DEFAULT '{"required_steps":["company","agent"]}'::jsonb,
  is_active            boolean     NOT NULL DEFAULT true,
  sort_order           integer     NOT NULL DEFAULT 0,
  created_by           uuid        REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 2.2 Sessões de onboarding
CREATE TABLE IF NOT EXISTS onboarding.tenant_onboarding_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid        NOT NULL REFERENCES onboarding.onboarding_templates(id),
  created_by      uuid        NOT NULL REFERENCES auth.users(id),
  tenant_id       uuid        REFERENCES public.tenants(id),
  status          text        NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft','in_progress','awaiting_channel',
               'ready_to_activate','activating','active','failed')
  ),
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  current_step    text,
  completed_steps text[]      NOT NULL DEFAULT '{}',
  error_message   text,
  activated_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 2.3 Controle de conexão do canal WhatsApp
CREATE TABLE IF NOT EXISTS onboarding.onboarding_channel_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES onboarding.tenant_onboarding_sessions(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','qr_ready','connected','failed')
  ),
  qr_code       text,
  phone_number  text,
  whatsapp_id   text,
  n8n_job_id    text,
  connected_at  timestamptz,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_channel_requests_session_unique UNIQUE (session_id)
);

-- 2.4 Outbox de jobs assíncronos para n8n
CREATE TABLE IF NOT EXISTS onboarding.onboarding_async_jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid        NOT NULL REFERENCES onboarding.tenant_onboarding_sessions(id) ON DELETE CASCADE,
  job_type        text        NOT NULL CHECK (job_type IN ('channel_provision','kb_vectorize','post_activation')),
  status          text        NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','processing','completed','failed')
  ),
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  result          jsonb,
  n8n_webhook_url text,
  attempts        integer     NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  completed_at    timestamptz,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE onboarding.onboarding_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding.tenant_onboarding_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding.onboarding_channel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding.onboarding_async_jobs       ENABLE ROW LEVEL SECURITY;

-- Templates: leitura para usuários autenticados
CREATE POLICY "Authenticated users view active templates"
  ON onboarding.onboarding_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Sessions: dono acessa suas próprias sessões
CREATE POLICY "Users manage own sessions"
  ON onboarding.tenant_onboarding_sessions FOR ALL
  TO authenticated
  USING (created_by = auth.uid());

-- Channel requests: acesso via sessão do dono
CREATE POLICY "Users access channel requests of own sessions"
  ON onboarding.onboarding_channel_requests FOR ALL
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM onboarding.tenant_onboarding_sessions
      WHERE created_by = auth.uid()
    )
  );

-- Async jobs: apenas service role (n8n usa service key)
CREATE POLICY "Service role full access on jobs"
  ON onboarding.onboarding_async_jobs FOR ALL
  TO service_role
  USING (true);

-- ============================================================
-- 4. REALTIME (QR code polling)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE onboarding.onboarding_channel_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE onboarding.tenant_onboarding_sessions;

-- ============================================================
-- 5. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_onb_sessions_created_by
  ON onboarding.tenant_onboarding_sessions(created_by);

CREATE INDEX IF NOT EXISTS idx_onb_sessions_status
  ON onboarding.tenant_onboarding_sessions(status);

CREATE INDEX IF NOT EXISTS idx_onb_sessions_template_id
  ON onboarding.tenant_onboarding_sessions(template_id);

CREATE INDEX IF NOT EXISTS idx_onb_channel_session
  ON onboarding.onboarding_channel_requests(session_id);

CREATE INDEX IF NOT EXISTS idx_onb_jobs_session
  ON onboarding.onboarding_async_jobs(session_id);

CREATE INDEX IF NOT EXISTS idx_onb_jobs_status
  ON onboarding.onboarding_async_jobs(status);

CREATE INDEX IF NOT EXISTS idx_onb_templates_niche
  ON onboarding.onboarding_templates(niche)
  WHERE is_active = true;

-- ============================================================
-- 6. RPCs
-- ============================================================

-- ------------------------------------------------------------
-- 6.1 create_session
-- Cria uma sessão a partir de um template com o default_payload
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION onboarding.create_session(
  p_template_id uuid,
  p_created_by  uuid
)
RETURNS onboarding.tenant_onboarding_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template onboarding.onboarding_templates%ROWTYPE;
  v_session  onboarding.tenant_onboarding_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_template
  FROM onboarding.onboarding_templates
  WHERE id = p_template_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template % não encontrado ou inativo', p_template_id;
  END IF;

  INSERT INTO onboarding.tenant_onboarding_sessions
    (template_id, created_by, status, payload)
  VALUES
    (p_template_id, p_created_by, 'draft', v_template.default_payload)
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

-- ------------------------------------------------------------
-- 6.2 save_step
-- Salva um bloco do payload (ex: "company", "agent", "tags")
-- Atualiza current_step e completed_steps
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION onboarding.save_step(
  p_session_id   uuid,
  p_step_key     text,
  p_step_payload jsonb,
  p_user_id      uuid
)
RETURNS onboarding.tenant_onboarding_sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session onboarding.tenant_onboarding_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM onboarding.tenant_onboarding_sessions
  WHERE id = p_session_id
    AND created_by = p_user_id
    AND status NOT IN ('activating', 'active', 'failed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão % não encontrada, não pertence ao usuário ou não é editável', p_session_id;
  END IF;

  UPDATE onboarding.tenant_onboarding_sessions
  SET
    payload         = jsonb_set(payload, ARRAY[p_step_key], p_step_payload, true),
    current_step    = p_step_key,
    completed_steps = array_append(
                        array_remove(completed_steps, p_step_key),
                        p_step_key
                      ),
    status          = CASE WHEN status = 'draft' THEN 'in_progress' ELSE status END,
    updated_at      = now()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

-- ------------------------------------------------------------
-- 6.3 validate_session
-- Valida requisitos mínimos para ativação com base em activation_rules
-- Retorna: { ready, missing[], stats }
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION onboarding.validate_session(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session        onboarding.tenant_onboarding_sessions%ROWTYPE;
  v_template       onboarding.onboarding_templates%ROWTYPE;
  v_missing        text[] := '{}';
  v_required_step  text;
  v_channel_status text;
  v_require_channel boolean;
BEGIN
  SELECT * INTO v_session
  FROM onboarding.tenant_onboarding_sessions
  WHERE id = p_session_id AND created_by = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão % não encontrada ou não pertence ao usuário', p_session_id;
  END IF;

  SELECT * INTO v_template
  FROM onboarding.onboarding_templates
  WHERE id = v_session.template_id;

  -- Verificar required_steps do template
  IF v_template.activation_rules ? 'required_steps' THEN
    FOR v_required_step IN
      SELECT jsonb_array_elements_text(v_template.activation_rules -> 'required_steps')
    LOOP
      IF NOT (v_session.payload ? v_required_step)
        OR (v_session.payload -> v_required_step = 'null'::jsonb)
        OR (v_session.payload -> v_required_step = '{}'::jsonb)
        OR (v_session.payload -> v_required_step = '[]'::jsonb)
      THEN
        v_missing := array_append(v_missing, v_required_step);
      END IF;
    END LOOP;
  END IF;

  -- Verificar canal se exigido pelo template
  v_require_channel := COALESCE(
    (v_template.activation_rules ->> 'require_channel')::boolean,
    false
  );

  IF v_require_channel THEN
    SELECT status INTO v_channel_status
    FROM onboarding.onboarding_channel_requests
    WHERE session_id = p_session_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_channel_status IS DISTINCT FROM 'connected' THEN
      v_missing := array_append(v_missing, 'channel_not_connected');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ready',   cardinality(v_missing) = 0,
    'missing', to_jsonb(v_missing),
    'stats', jsonb_build_object(
      'completed_steps',  array_length(v_session.completed_steps, 1),
      'total_steps',      jsonb_array_length(v_template.wizard_schema),
      'status',           v_session.status,
      'current_step',     v_session.current_step
    )
  );
END;
$$;

-- ------------------------------------------------------------
-- 6.4 activate_session
-- Provisiona tudo em public.* e cria jobs para n8n
-- SECURITY DEFINER: roda com permissões do owner da função
-- Idempotente: bloqueia se status != 'ready_to_activate'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION onboarding.activate_session(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session    onboarding.tenant_onboarding_sessions%ROWTYPE;
  v_template   onboarding.onboarding_templates%ROWTYPE;
  v_payload    jsonb;
  v_tenant_id  uuid;
  v_agent_id   uuid;
  v_tag        jsonb;
  v_step       jsonb;
  v_step_id    uuid;
  v_tag_name   text;
  v_tag_id     uuid;
  v_channel    record;
  v_niche_id   uuid;
BEGIN
  -- 1. Travar sessão (garante idempotência)
  SELECT * INTO v_session
  FROM onboarding.tenant_onboarding_sessions
  WHERE id = p_session_id
    AND created_by = p_user_id
    AND status = 'ready_to_activate'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão % não está pronta para ativação (status deve ser ready_to_activate)', p_session_id;
  END IF;

  SELECT * INTO v_template
  FROM onboarding.onboarding_templates
  WHERE id = v_session.template_id;

  v_payload := v_session.payload;

  -- Marcar como ativando
  UPDATE onboarding.tenant_onboarding_sessions
  SET status = 'activating', updated_at = now()
  WHERE id = p_session_id;

  -- 2. Resolver niche_id
  SELECT id INTO v_niche_id
  FROM public.niches
  WHERE LOWER(name) = LOWER(v_template.niche)
  LIMIT 1;

  -- 3. Criar tenant
  INSERT INTO public.tenants (
    name,
    neurocore_id,
    cnpj,
    phone,
    responsible_tech_name,
    responsible_tech_whatsapp,
    responsible_tech_email,
    responsible_finance_name,
    responsible_finance_whatsapp,
    responsible_finance_email,
    plan,
    niche_id,
    subscription_status,
    is_active
  ) VALUES (
    v_payload -> 'company' ->> 'trade_name',
    v_template.default_neurocore_id,
    COALESCE(v_payload -> 'company' ->> 'cnpj', ''),
    COALESCE(v_payload -> 'company' ->> 'phone', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'technical' ->> 'name', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'technical' ->> 'whatsapp', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'technical' ->> 'email', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'financial' ->> 'name', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'financial' ->> 'whatsapp', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'financial' ->> 'email', ''),
    COALESCE(v_payload -> 'company' ->> 'plan', 'trial'),
    v_niche_id,
    'trialing',
    true
  )
  RETURNING id INTO v_tenant_id;

  -- 4. Criar wallet
  INSERT INTO public.wallets (tenant_id, balance_credits)
  VALUES (v_tenant_id, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- 5. Criar agent
  INSERT INTO public.agents (
    name,
    type,
    reactive,
    id_neurocore
  ) VALUES (
    COALESCE(v_payload -> 'agent' ->> 'name', 'Lívia'),
    COALESCE(v_payload -> 'agent' ->> 'type', 'attendant')::agent_type_enum,
    COALESCE((v_payload -> 'agent' ->> 'reactive')::boolean, true),
    v_template.default_neurocore_id
  )
  RETURNING id INTO v_agent_id;

  -- 6. Criar agent_prompts (persona)
  INSERT INTO public.agent_prompts (
    name,
    age,
    gender,
    objective,
    comunication,
    personality,
    id_agent,
    id_tenant
  ) VALUES (
    COALESCE(v_payload -> 'agent' ->> 'name', 'Lívia'),
    COALESCE(v_payload -> 'agent' -> 'persona' ->> 'age', ''),
    COALESCE(v_payload -> 'agent' -> 'persona' ->> 'gender', 'female')::agent_gender_enum,
    COALESCE(v_payload -> 'agent' -> 'profile' ->> 'objective', ''),
    COALESCE(v_payload -> 'agent' -> 'profile' ->> 'communication', ''),
    COALESCE(v_payload -> 'agent' -> 'profile' ->> 'personality', ''),
    v_agent_id,
    v_tenant_id
  );

  -- 7. Criar agent_prompts_guard_rails
  INSERT INTO public.agent_prompts_guard_rails (
    prompt_jailbreak,
    prompt_nsfw,
    id_agent,
    id_tenant
  ) VALUES (
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'guardrails' ->> 'prompt_jailbreak', ''),
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'guardrails' ->> 'prompt_nsfw', ''),
    v_agent_id,
    v_tenant_id
  );

  -- 8. Criar agent_prompts_intention
  INSERT INTO public.agent_prompts_intention (
    prompt,
    id_agent,
    id_tenant
  ) VALUES (
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'intentions' ->> 'prompt', ''),
    v_agent_id,
    v_tenant_id
  );

  -- 9. Criar agent_prompts_internal_system
  INSERT INTO public.agent_prompts_internal_system (
    prompt,
    id_agent,
    id_tenant
  ) VALUES (
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'internal_system' ->> 'prompt', ''),
    v_agent_id,
    v_tenant_id
  );

  -- 10. Criar agent_prompts_observer
  INSERT INTO public.agent_prompts_observer (
    prompt,
    id_agent,
    id_tenant
  ) VALUES (
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'observer' ->> 'prompt', ''),
    v_agent_id,
    v_tenant_id
  );

  -- 11. Criar tags
  IF v_payload ? 'tags' AND v_payload -> 'tags' ? 'items' THEN
    FOR v_tag IN SELECT * FROM jsonb_array_elements(v_payload -> 'tags' -> 'items')
    LOOP
      INSERT INTO public.tags (
        tag_name,
        color,
        order_index,
        active,
        pause_ia_on_apply,
        tenant_id,
        id_neurocore
      ) VALUES (
        v_tag ->> 'tag_name',
        COALESCE(v_tag ->> 'color', '#3b82f6'),
        COALESCE((v_tag ->> 'order_index')::integer, 0),
        COALESCE((v_tag ->> 'active')::boolean, true),
        COALESCE((v_tag ->> 'pause_ia_on_apply')::boolean, false),
        v_tenant_id,
        v_template.default_neurocore_id
      );
    END LOOP;
  END IF;

  -- 12. Criar timeout settings
  INSERT INTO public.tenant_conversation_timeout_settings (
    tenant_id,
    ia_inactive_timeout_minutes,
    closure_message,
    is_active
  ) VALUES (
    v_tenant_id,
    COALESCE((v_payload -> 'conversation_rules' -> 'timeouts' ->> 'ia_inactive_timeout_minutes')::integer, 30),
    COALESCE(v_payload -> 'conversation_rules' -> 'timeouts' ->> 'closure_message', 'Conversa encerrada por inatividade.'),
    COALESCE((v_payload -> 'conversation_rules' -> 'timeouts' ->> 'is_active')::boolean, true)
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    ia_inactive_timeout_minutes = EXCLUDED.ia_inactive_timeout_minutes,
    closure_message             = EXCLUDED.closure_message,
    is_active                   = EXCLUDED.is_active,
    updated_at                  = now();

  -- 13. Criar reactivation settings
  INSERT INTO public.tenant_reactivation_settings (
    tenant_id,
    exhausted_action,
    exhausted_message,
    max_reactivation_window_minutes,
    max_window_action,
    max_window_message
  ) VALUES (
    v_tenant_id,
    COALESCE(v_payload -> 'conversation_rules' -> 'reactivation' ->> 'exhausted_action', 'end_conversation')::tenant_reactivation_fallback_action,
    COALESCE(v_payload -> 'conversation_rules' -> 'reactivation' ->> 'exhausted_message', 'Conversa encerrada devido inatividade.'),
    COALESCE((v_payload -> 'conversation_rules' -> 'reactivation' ->> 'max_reactivation_window_minutes')::integer, 1440),
    COALESCE(v_payload -> 'conversation_rules' -> 'reactivation' ->> 'max_window_action', 'end_conversation')::tenant_reactivation_fallback_action,
    COALESCE(v_payload -> 'conversation_rules' -> 'reactivation' ->> 'max_window_message', 'Janela máxima atingida.')
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    exhausted_action                = EXCLUDED.exhausted_action,
    exhausted_message               = EXCLUDED.exhausted_message,
    max_reactivation_window_minutes = EXCLUDED.max_reactivation_window_minutes,
    max_window_action               = EXCLUDED.max_window_action,
    max_window_message              = EXCLUDED.max_window_message,
    updated_at                      = now();

  -- 14. Criar reactivation steps
  IF v_payload ? 'conversation_rules' AND v_payload -> 'conversation_rules' ? 'reactivation_steps' THEN
    FOR v_step IN
      SELECT * FROM jsonb_array_elements(v_payload -> 'conversation_rules' -> 'reactivation_steps')
    LOOP
      INSERT INTO public.tenant_reactivation_rules_steps (
        tenant_id,
        sequence,
        wait_time_minutes,
        action_type,
        action_parameter,
        start_time,
        end_time
      ) VALUES (
        v_tenant_id,
        COALESCE((v_step ->> 'sequence')::integer, 1),
        COALESCE((v_step ->> 'wait_time_minutes')::integer, 15),
        COALESCE(v_step ->> 'action_type', 'send_message')::reactivation_action_type,
        v_step ->> 'action_parameter',
        (v_step ->> 'start_time')::time,
        (v_step ->> 'end_time')::time
      )
      RETURNING id INTO v_step_id;

      -- Associar tags ao step
      IF v_step ? 'tags_to_apply' THEN
        FOR v_tag_name IN
          SELECT jsonb_array_elements_text(v_step -> 'tags_to_apply')
        LOOP
          SELECT id INTO v_tag_id
          FROM public.tags
          WHERE tenant_id = v_tenant_id
            AND LOWER(tag_name) = LOWER(v_tag_name)
          LIMIT 1;

          IF v_tag_id IS NOT NULL THEN
            INSERT INTO public.tenant_reactivation_rules_steps_tags
              (reactivation_rule_step_id, tag_id)
            VALUES (v_step_id, v_tag_id)
            ON CONFLICT DO NOTHING;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 15. Criar base_conhecimentos (metadados, sem vetores)
  IF v_payload ? 'knowledge' THEN
    INSERT INTO public.base_conhecimentos (
      tenant_id,
      name,
      description,
      neurocore_id,
      is_active
    ) VALUES (
      v_tenant_id,
      COALESCE(v_payload -> 'knowledge' ->> 'name', 'Base de Conhecimento'),
      v_payload -> 'knowledge' ->> 'description',
      v_template.default_neurocore_id,
      false  -- vetores ainda não existem, n8n ativa depois
    );
  END IF;

  -- 16. Criar channel se já estiver conectado
  IF (v_payload -> 'channel' ->> 'connection_status') = 'connected'
    AND v_payload -> 'channel' ->> 'provider_id' IS NOT NULL
  THEN
    INSERT INTO public.channels (
      tenant_id,
      channel_provider_id,
      name,
      identification_number,
      provider_external_channel_id,
      is_active
    ) VALUES (
      v_tenant_id,
      (v_payload -> 'channel' ->> 'provider_id')::uuid,
      COALESCE(v_payload -> 'channel' ->> 'desired_number', 'Canal WhatsApp'),
      COALESCE(v_payload -> 'channel' ->> 'desired_number', ''),
      v_payload -> 'channel' ->> 'external_channel_id',
      true
    );
  END IF;

  -- 17. Atualizar usuário criador com o novo tenant
  UPDATE public.users
  SET tenant_id = v_tenant_id, updated_at = now()
  WHERE id = p_user_id;

  -- 18. Criar async jobs para n8n
  INSERT INTO onboarding.onboarding_async_jobs
    (session_id, job_type, payload)
  VALUES
    (
      p_session_id,
      'kb_vectorize',
      jsonb_build_object(
        'tenant_id',  v_tenant_id,
        'session_id', p_session_id,
        'knowledge',  v_payload -> 'knowledge',
        'faq',        v_payload -> 'faq',
        'catalog',    v_payload -> 'catalog'
      )
    ),
    (
      p_session_id,
      'post_activation',
      jsonb_build_object(
        'tenant_id',  v_tenant_id,
        'session_id', p_session_id,
        'agent_id',   v_agent_id
      )
    );

  -- 19. Finalizar sessão
  UPDATE onboarding.tenant_onboarding_sessions
  SET
    status       = 'active',
    tenant_id    = v_tenant_id,
    activated_at = now(),
    updated_at   = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success',    true,
    'tenant_id',  v_tenant_id,
    'agent_id',   v_agent_id,
    'session_id', p_session_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Reverter status para failed e registrar erro
  UPDATE onboarding.tenant_onboarding_sessions
  SET
    status        = 'failed',
    error_message = SQLERRM,
    updated_at    = now()
  WHERE id = p_session_id;

  RAISE;
END;
$$;

-- ------------------------------------------------------------
-- 6.5 channel_upsert_state
-- Callback do n8n para atualizar estado da conexão do canal
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION onboarding.channel_upsert_state(
  p_session_id   uuid,
  p_status       text,
  p_qr_code      text    DEFAULT NULL,
  p_phone_number text    DEFAULT NULL,
  p_whatsapp_id  text    DEFAULT NULL,
  p_n8n_job_id   text    DEFAULT NULL,
  p_error        text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO onboarding.onboarding_channel_requests
    (session_id, status, qr_code, phone_number, whatsapp_id, n8n_job_id, error_message, connected_at)
  VALUES (
    p_session_id,
    p_status,
    p_qr_code,
    p_phone_number,
    p_whatsapp_id,
    p_n8n_job_id,
    p_error,
    CASE WHEN p_status = 'connected' THEN now() ELSE NULL END
  )
  ON CONFLICT (session_id) DO UPDATE SET
    status        = EXCLUDED.status,
    qr_code       = COALESCE(EXCLUDED.qr_code,       onboarding_channel_requests.qr_code),
    phone_number  = COALESCE(EXCLUDED.phone_number,  onboarding_channel_requests.phone_number),
    whatsapp_id   = COALESCE(EXCLUDED.whatsapp_id,   onboarding_channel_requests.whatsapp_id),
    n8n_job_id    = COALESCE(EXCLUDED.n8n_job_id,    onboarding_channel_requests.n8n_job_id),
    error_message = EXCLUDED.error_message,
    connected_at  = CASE
                      WHEN EXCLUDED.status = 'connected' THEN now()
                      ELSE onboarding_channel_requests.connected_at
                    END,
    updated_at    = now();

  -- Se conectado: atualizar payload da sessão e avançar status
  IF p_status = 'connected' THEN
    UPDATE onboarding.tenant_onboarding_sessions
    SET
      payload = jsonb_set(
        jsonb_set(
          jsonb_set(
            payload,
            '{channel,connection_status}', '"connected"'::jsonb, true
          ),
          '{channel,desired_number}', to_jsonb(p_phone_number), true
        ),
        '{channel,external_channel_id}', to_jsonb(p_whatsapp_id), true
      ),
      status     = CASE WHEN status = 'awaiting_channel' THEN 'ready_to_activate' ELSE status END,
      updated_at = now()
    WHERE id = p_session_id;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 6.6 kb_vectorize_result
-- Callback do n8n após vetorização da base de conhecimento
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION onboarding.kb_vectorize_result(
  p_session_id      uuid,
  p_base_id         uuid,
  p_vectors_created integer DEFAULT 0,
  p_success         boolean DEFAULT true,
  p_error           text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ativar base de conhecimento se vetorização teve sucesso
  IF p_success AND p_base_id IS NOT NULL THEN
    UPDATE public.base_conhecimentos
    SET is_active = true, updated_at = now()
    WHERE id = p_base_id;
  END IF;

  -- Marcar job
  UPDATE onboarding.onboarding_async_jobs
  SET
    status        = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    result        = jsonb_build_object(
                      'vectors_created', p_vectors_created,
                      'base_id',         p_base_id
                    ),
    error_message = p_error,
    completed_at  = CASE WHEN p_success THEN now() ELSE NULL END,
    updated_at    = now()
  WHERE session_id = p_session_id AND job_type = 'kb_vectorize';
END;
$$;

-- ------------------------------------------------------------
-- 6.7 post_activation_result
-- Callback do n8n após pós-ativação (mensagem teste, notificações)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION onboarding.post_activation_result(
  p_session_id uuid,
  p_success    boolean DEFAULT true,
  p_result     jsonb   DEFAULT NULL,
  p_error      text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE onboarding.onboarding_async_jobs
  SET
    status        = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    result        = p_result,
    error_message = p_error,
    completed_at  = CASE WHEN p_success THEN now() ELSE NULL END,
    updated_at    = now()
  WHERE session_id = p_session_id AND job_type = 'post_activation';
END;
$$;
