-- ============================================================
-- Migration: Onboarding Read RPCs (public schema wrappers)
-- Necessário porque o schema `onboarding` não está exposto no
-- PostgREST — mesmo com service role, `.schema()` é bloqueado.
-- Solução: funções SECURITY DEFINER no schema public que lêem
-- diretamente as tabelas do schema onboarding.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Listar templates ativos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.onboarding_get_active_templates()
RETURNS TABLE (
  id                   uuid,
  name                 text,
  niche                text,
  description          text,
  default_neurocore_id uuid,
  wizard_schema        jsonb,
  default_payload      jsonb,
  activation_rules     jsonb,
  is_active            boolean,
  sort_order           integer,
  created_at           timestamptz,
  updated_at           timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = onboarding, public
AS $$
  SELECT
    id, name, niche, description, default_neurocore_id,
    wizard_schema, default_payload, activation_rules,
    is_active, sort_order, created_at, updated_at
  FROM onboarding.onboarding_templates
  WHERE is_active = true
  ORDER BY sort_order ASC;
$$;

GRANT EXECUTE ON FUNCTION public.onboarding_get_active_templates() TO authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Buscar template por ID
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.onboarding_get_template(p_template_id uuid)
RETURNS TABLE (
  id                   uuid,
  name                 text,
  niche                text,
  description          text,
  default_neurocore_id uuid,
  wizard_schema        jsonb,
  default_payload      jsonb,
  activation_rules     jsonb,
  is_active            boolean,
  sort_order           integer,
  created_at           timestamptz,
  updated_at           timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = onboarding, public
AS $$
  SELECT
    id, name, niche, description, default_neurocore_id,
    wizard_schema, default_payload, activation_rules,
    is_active, sort_order, created_at, updated_at
  FROM onboarding.onboarding_templates
  WHERE id = p_template_id AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.onboarding_get_template(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Buscar sessão por ID (valida ownership via created_by)
--    Retorna a sessão + campos do template com prefixo t_
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.onboarding_get_session(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS TABLE (
  -- session fields
  id              uuid,
  template_id     uuid,
  created_by      uuid,
  tenant_id       uuid,
  status          text,
  payload         jsonb,
  current_step    text,
  completed_steps text[],
  error_message   text,
  activated_at    timestamptz,
  updated_at      timestamptz,
  created_at      timestamptz,
  -- template fields (prefixo t_)
  t_id                   uuid,
  t_name                 text,
  t_niche                text,
  t_description          text,
  t_default_neurocore_id uuid,
  t_wizard_schema        jsonb,
  t_default_payload      jsonb,
  t_activation_rules     jsonb,
  t_is_active            boolean,
  t_sort_order           integer,
  t_created_at           timestamptz,
  t_updated_at           timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = onboarding, public
AS $$
  SELECT
    s.id, s.template_id, s.created_by, s.tenant_id, s.status,
    s.payload, s.current_step, s.completed_steps,
    s.error_message, s.activated_at, s.updated_at, s.created_at,
    t.id, t.name, t.niche, t.description, t.default_neurocore_id,
    t.wizard_schema, t.default_payload, t.activation_rules,
    t.is_active, t.sort_order, t.created_at, t.updated_at
  FROM onboarding.tenant_onboarding_sessions s
  JOIN onboarding.onboarding_templates t ON t.id = s.template_id
  WHERE s.id = p_session_id
    AND s.created_by = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.onboarding_get_session(uuid, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Buscar última sessão em andamento do usuário
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.onboarding_get_latest_session(p_user_id uuid)
RETURNS TABLE (
  id              uuid,
  template_id     uuid,
  created_by      uuid,
  tenant_id       uuid,
  status          text,
  payload         jsonb,
  current_step    text,
  completed_steps text[],
  error_message   text,
  activated_at    timestamptz,
  updated_at      timestamptz,
  created_at      timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = onboarding, public
AS $$
  SELECT
    id, template_id, created_by, tenant_id, status,
    payload, current_step, completed_steps,
    error_message, activated_at, updated_at, created_at
  FROM onboarding.tenant_onboarding_sessions
  WHERE created_by = p_user_id
    AND status NOT IN ('active', 'failed')
  ORDER BY updated_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.onboarding_get_latest_session(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 5. Wrapper: create_session
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.onboarding_create_session(
  p_template_id uuid,
  p_created_by  uuid
)
RETURNS TABLE (
  id              uuid,
  template_id     uuid,
  created_by      uuid,
  tenant_id       uuid,
  status          text,
  payload         jsonb,
  current_step    text,
  completed_steps text[],
  error_message   text,
  activated_at    timestamptz,
  updated_at      timestamptz,
  created_at      timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = onboarding, public
AS $$
  SELECT
    s.id, s.template_id, s.created_by, s.tenant_id, s.status,
    s.payload, s.current_step, s.completed_steps,
    s.error_message, s.activated_at, s.updated_at, s.created_at
  FROM onboarding.create_session(p_template_id, p_created_by) s;
$$;

GRANT EXECUTE ON FUNCTION public.onboarding_create_session(uuid, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 6. Wrapper: save_step
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.onboarding_save_step(
  p_session_id   uuid,
  p_step_key     text,
  p_step_payload jsonb,
  p_user_id      uuid
)
RETURNS TABLE (
  id              uuid,
  template_id     uuid,
  created_by      uuid,
  tenant_id       uuid,
  status          text,
  payload         jsonb,
  current_step    text,
  completed_steps text[],
  error_message   text,
  activated_at    timestamptz,
  updated_at      timestamptz,
  created_at      timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = onboarding, public
AS $$
  SELECT
    s.id, s.template_id, s.created_by, s.tenant_id, s.status,
    s.payload, s.current_step, s.completed_steps,
    s.error_message, s.activated_at, s.updated_at, s.created_at
  FROM onboarding.save_step(p_session_id, p_step_key, p_step_payload, p_user_id) s;
$$;

GRANT EXECUTE ON FUNCTION public.onboarding_save_step(uuid, text, jsonb, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 7. Wrapper: validate_session
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.onboarding_validate_session(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = onboarding, public
AS $$
  SELECT onboarding.validate_session(p_session_id, p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.onboarding_validate_session(uuid, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 8. Wrapper: activate_session
-- Promove status para ready_to_activate e executa ativação
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.onboarding_activate_session(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = onboarding, public
AS $$
BEGIN
  -- Promover status para ready_to_activate (se ainda não estiver)
  UPDATE onboarding.tenant_onboarding_sessions
  SET status = 'ready_to_activate', updated_at = now()
  WHERE id = p_session_id
    AND created_by = p_user_id
    AND status IN ('draft', 'in_progress');

  -- Chamar o activate_session do schema onboarding
  RETURN onboarding.activate_session(p_session_id, p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.onboarding_activate_session(uuid, uuid) TO authenticated, service_role;
