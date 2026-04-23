-- ============================================================================
-- RPC: upsert_contact_conversation
-- Chamada pelo Go Gateway no Passo 2 do inbound pipeline.
--
-- Responsabilidade: em uma única transação,
--   1. Faz upsert do contato por (tenant_id, external_identification_contact)
--   2. Verifica is_muted — retorna cedo se true (Go vai dropar a mensagem)
--   3. Faz upsert da conversa aberta por (contact_id, channel_id)
--      - Se existe: atualiza last_message_at + zera consecutive_reactivations
--      - Se não existe: cria nova com ia_active=true (padrão)
--   4. Retorna {contact_id, conversation_id, is_muted}
--
-- Quem chama: gateway/persister.go — após channel lookup, antes de INSERT message
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_contact_conversation(
  p_tenant_id  uuid,
  p_channel_id uuid,
  p_logical_jid text,   -- external_identification_contact (JID do WhatsApp)
  p_phone      text,    -- número limpo (sem @s.whatsapp.net)
  p_name       text     -- pushName (pode ser vazio — usa phone como fallback)
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_contact_id uuid;
  v_is_muted   boolean;
  v_conv_id    uuid;
  v_name_safe  text;
BEGIN
  -- Nome nunca pode ser vazio (contacts.name NOT NULL)
  v_name_safe := NULLIF(trim(p_name), '');
  IF v_name_safe IS NULL THEN
    v_name_safe := NULLIF(trim(p_phone), '');
  END IF;
  IF v_name_safe IS NULL THEN
    v_name_safe := 'Contato';
  END IF;

  -- -------------------------------------------------------------------------
  -- 1. Upsert contato
  --    Chave: (tenant_id, external_identification_contact)
  --    Update: phone e name só se o novo valor for não-vazio (não apaga dado existente)
  -- -------------------------------------------------------------------------
  SELECT id, is_muted
    INTO v_contact_id, v_is_muted
  FROM public.contacts
  WHERE tenant_id = p_tenant_id
    AND external_identification_contact = p_logical_jid;

  IF NOT FOUND THEN
    INSERT INTO public.contacts (
      tenant_id,
      external_identification_contact,
      phone,
      name,
      status,
      last_interaction_at
    ) VALUES (
      p_tenant_id,
      p_logical_jid,
      COALESCE(NULLIF(trim(p_phone), ''), p_logical_jid),
      v_name_safe,
      'open',
      now()
    )
    RETURNING id, is_muted INTO v_contact_id, v_is_muted;
  ELSE
    UPDATE public.contacts SET
      phone             = CASE WHEN trim(p_phone) <> '' THEN p_phone ELSE phone END,
      name              = CASE WHEN trim(p_name)  <> '' THEN p_name  ELSE name  END,
      last_interaction_at = now(),
      updated_at        = now()
    WHERE id = v_contact_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. Check is_muted — retorna sem tocar em conversa ou mensagem
  -- -------------------------------------------------------------------------
  IF v_is_muted THEN
    RETURN jsonb_build_object(
      'contact_id',      v_contact_id,
      'conversation_id', null,
      'is_muted',        true
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- 3. Upsert conversa aberta
  -- -------------------------------------------------------------------------
  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE contact_id = v_contact_id
    AND channel_id = p_channel_id
    AND status = 'open'
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    -- Conversa existente: atualiza timestamp e reseta contador de reativações
    UPDATE public.conversations SET
      last_message_at           = now(),
      consecutive_reactivations = 0,
      has_unread                = true,
      updated_at                = now()
    WHERE id = v_conv_id;
  ELSE
    -- Nova conversa: ia_active=true por padrão (padrão da plataforma)
    INSERT INTO public.conversations (
      tenant_id,
      contact_id,
      channel_id,
      status,
      ia_active,
      last_message_at,
      has_unread,
      unread_count,
      consecutive_reactivations,
      total_reactivations
    ) VALUES (
      p_tenant_id,
      v_contact_id,
      p_channel_id,
      'open',
      true,
      now(),
      true,
      1,
      0,
      0
    )
    RETURNING id INTO v_conv_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- 4. Retorna resultado para o Go Gateway
  -- -------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'contact_id',      v_contact_id,
    'conversation_id', v_conv_id,
    'is_muted',        false
  );
END;
$$;

-- Permissão para service_role (usado pelo Go Gateway via SUPABASE_SERVICE_ROLE_KEY)
GRANT EXECUTE ON FUNCTION public.upsert_contact_conversation(uuid, uuid, text, text, text)
  TO service_role;
