-- =============================================================================
-- Guard: ia_active deve respeitar o horário do agente na criação de conversas
-- =============================================================================
-- Problema identificado: o fluxo n8n cria novas conversas com ia_active = true
-- por padrão sem verificar o endpoint is-online. Quando uma mensagem chega fora
-- do horário configurado, a IA respondia porque ia_active estava true.
--
-- Solução: trigger BEFORE INSERT em conversations que chama is_agent_online().
-- Se o agente estiver offline, sobrescreve ia_active = false antes de persistir.
-- Funciona independente de quem cria a conversa (n8n, API, etc).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Função do trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_ia_active_on_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Só actua quando ia_active = true está sendo definido
  IF NEW.ia_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Sem tenant_id não há schedule para checar
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Consulta o schedule actual do tenant
  SELECT public.is_agent_online(NEW.tenant_id) INTO v_result;

  -- Se offline → força ia_active = false e registra o motivo
  IF (v_result->>'online')::boolean = false THEN
    NEW.ia_active   := false;
    NEW.pause_notes := 'IA inativa — fora do horário configurado [schedule]';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Trigger: BEFORE INSERT em conversations
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_conversations_ia_active_schedule_guard'
  ) THEN
    CREATE TRIGGER trg_conversations_ia_active_schedule_guard
      BEFORE INSERT ON public.conversations
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_ia_active_on_schedule();
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Comentários
-- ---------------------------------------------------------------------------

COMMENT ON FUNCTION public.guard_ia_active_on_schedule() IS
  'Trigger BEFORE INSERT em conversations: se o agente estiver offline pelo '
  'schedule no momento da criação da conversa, força ia_active = false. '
  'Garante que novas conversas iniciadas fora do horário não sejam atendidas '
  'pela IA mesmo que o criador (n8n, API, etc) envie ia_active = true.';
