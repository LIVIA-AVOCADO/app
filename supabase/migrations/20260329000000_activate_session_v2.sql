-- ============================================================
-- Migration: atualizar activate_session para usar niche_channel_defaults
-- Mudanças:
--   1. niche_id via FK (v_template.niche_id) em vez de text match
--   2. neurocore_id lido de niche_channel_defaults (fallback: template)
--   3. channel_provider_id lido de niche_channel_defaults (fallback: payload)
-- ============================================================

CREATE OR REPLACE FUNCTION onboarding.activate_session(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session          onboarding.tenant_onboarding_sessions%ROWTYPE;
  v_template         onboarding.onboarding_templates%ROWTYPE;
  v_payload          jsonb;
  v_tenant_id        uuid;
  v_agent_id         uuid;
  v_tag              jsonb;
  v_step             jsonb;
  v_step_id          uuid;
  v_tag_name         text;
  v_tag_id           uuid;
  v_channel          record;
  v_niche_id         uuid;
  v_neurocore_id     uuid;
  v_provider_id      uuid;
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

  -- 2. Resolver niche_id — FK direta, com fallback para text match (compatibilidade)
  v_niche_id := COALESCE(
    v_template.niche_id,
    (SELECT id FROM public.niches WHERE LOWER(name) = LOWER(v_template.niche) LIMIT 1)
  );

  -- 3. Resolver neurocore_id e channel_provider_id de niche_channel_defaults
  --    Fallback: neurocore do template (retrocompatibilidade), provider do payload
  SELECT ncd.neurocore_id, ncd.channel_provider_id
  INTO   v_neurocore_id, v_provider_id
  FROM   public.niche_channel_defaults ncd
  JOIN   public.channel_types ct ON ct.id = ncd.channel_type_id
  WHERE  ncd.niche_id   = v_niche_id
    AND  ct.name        = 'whatsapp'
    AND  ncd.is_active  = true
  LIMIT 1;

  -- Fallbacks se niche_channel_defaults não existir
  v_neurocore_id := COALESCE(v_neurocore_id, v_template.default_neurocore_id);
  v_provider_id  := COALESCE(
    v_provider_id,
    (v_payload -> 'channel' ->> 'provider_id')::uuid
  );

  -- 4. Criar tenant
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
    v_neurocore_id,
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

  -- 5. Criar wallet
  INSERT INTO public.wallets (tenant_id, balance_credits)
  VALUES (v_tenant_id, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- 6. Criar agent
  INSERT INTO public.agents (
    name,
    type,
    reactive,
    id_neurocore
  ) VALUES (
    COALESCE(v_payload -> 'agent' ->> 'name', 'Lívia'),
    COALESCE(v_payload -> 'agent' ->> 'type', 'attendant')::agent_type_enum,
    COALESCE((v_payload -> 'agent' ->> 'reactive')::boolean, true),
    v_neurocore_id
  )
  RETURNING id INTO v_agent_id;

  -- 7. Criar agent_prompts (persona)
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

  -- 8. Criar agent_prompts_guard_rails
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

  -- 9. Criar agent_prompts_intention
  INSERT INTO public.agent_prompts_intention (
    prompt,
    id_agent,
    id_tenant
  ) VALUES (
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'intentions' ->> 'prompt', ''),
    v_agent_id,
    v_tenant_id
  );

  -- 10. Criar agent_prompts_internal_system
  INSERT INTO public.agent_prompts_internal_system (
    prompt,
    id_agent,
    id_tenant
  ) VALUES (
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'internal_system' ->> 'prompt', ''),
    v_agent_id,
    v_tenant_id
  );

  -- 11. Criar agent_prompts_observer
  INSERT INTO public.agent_prompts_observer (
    prompt,
    id_agent,
    id_tenant
  ) VALUES (
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'observer' ->> 'prompt', ''),
    v_agent_id,
    v_tenant_id
  );

  -- 12. Criar tags
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
        v_neurocore_id
      );
    END LOOP;
  END IF;

  -- 13. Criar timeout settings
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

  -- 14. Criar reactivation settings
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

  -- 15. Criar reactivation steps
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

  -- 16. Criar base_conhecimentos (metadados, sem vetores)
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
      v_neurocore_id,
      false  -- vetores ainda não existem, n8n ativa depois
    );
  END IF;

  -- 17. Criar channel se já estiver conectado
  --     provider_id vem de niche_channel_defaults (v_provider_id), payload é fallback
  IF (v_payload -> 'channel' ->> 'connection_status') = 'connected'
    AND v_provider_id IS NOT NULL
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
      v_provider_id,
      COALESCE(v_payload -> 'channel' ->> 'desired_number', 'Canal WhatsApp'),
      COALESCE(v_payload -> 'channel' ->> 'desired_number', ''),
      v_payload -> 'channel' ->> 'external_channel_id',
      true
    );
  END IF;

  -- 18. Atualizar usuário criador com o novo tenant
  UPDATE public.users
  SET tenant_id = v_tenant_id, updated_at = now()
  WHERE id = p_user_id;

  -- 19. Criar async jobs para n8n
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

  -- 20. Finalizar sessão
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
  UPDATE onboarding.tenant_onboarding_sessions
  SET
    status        = 'failed',
    error_message = SQLERRM,
    updated_at    = now()
  WHERE id = p_session_id;

  RAISE;
END;
$$;
