-- ============================================================
-- MIGRATION: Função generate_metrics_daily
-- Calcula e faz upsert em metrics_daily para todos os tenants
-- em uma data específica (padrão: ontem).
-- Chamada por job n8n ou API admin diariamente.
-- ============================================================

CREATE OR REPLACE FUNCTION generate_metrics_daily(p_date date DEFAULT CURRENT_DATE - 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant   record;
  v_total    int;
  v_closed   int;
  v_ai       int;
  v_human    int;
  v_avg_res  int;
  v_csat_pos int;
  v_csat_neg int;
  v_count    int := 0;
BEGIN
  FOR v_tenant IN SELECT id FROM tenants LOOP

    -- Conversas criadas na data
    SELECT COUNT(*)
      INTO v_total
      FROM conversations
     WHERE tenant_id = v_tenant.id
       AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = p_date;

    -- Conversas encerradas na data
    SELECT COUNT(*)
      INTO v_closed
      FROM conversations
     WHERE tenant_id = v_tenant.id
       AND status = 'closed'
       AND DATE(updated_at AT TIME ZONE 'America/Sao_Paulo') = p_date;

    -- IA handled (encerradas na data com ia_active=true)
    SELECT COUNT(*)
      INTO v_ai
      FROM conversations
     WHERE tenant_id = v_tenant.id
       AND status = 'closed'
       AND ia_active = true
       AND DATE(updated_at AT TIME ZONE 'America/Sao_Paulo') = p_date;

    -- Human handled (encerradas na data com ia_active=false)
    v_human := v_closed - v_ai;

    -- Tempo médio de resolução em segundos (conversas encerradas na data)
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))::int, NULL)
      INTO v_avg_res
      FROM conversations
     WHERE tenant_id = v_tenant.id
       AND status = 'closed'
       AND DATE(updated_at AT TIME ZONE 'America/Sao_Paulo') = p_date;

    -- CSAT positivo (mensagens com feedback_type='like' na data)
    SELECT COUNT(*)
      INTO v_csat_pos
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
     WHERE c.tenant_id = v_tenant.id
       AND m.feedback_type = 'like'
       AND DATE(m.created_at AT TIME ZONE 'America/Sao_Paulo') = p_date;

    -- CSAT negativo (mensagens com feedback_type='dislike' na data)
    SELECT COUNT(*)
      INTO v_csat_neg
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
     WHERE c.tenant_id = v_tenant.id
       AND m.feedback_type = 'dislike'
       AND DATE(m.created_at AT TIME ZONE 'America/Sao_Paulo') = p_date;

    -- Só insere se houver alguma atividade
    IF v_total > 0 OR v_closed > 0 OR v_csat_pos > 0 OR v_csat_neg > 0 THEN
      INSERT INTO metrics_daily (
        tenant_id,
        date,
        total_conversations,
        closed_conversations,
        ai_handled,
        human_handled,
        avg_resolution_s,
        csat_positive,
        csat_negative
      ) VALUES (
        v_tenant.id,
        p_date,
        v_total,
        v_closed,
        v_ai,
        v_human,
        v_avg_res,
        v_csat_pos,
        v_csat_neg
      )
      ON CONFLICT (tenant_id, date) DO UPDATE SET
        total_conversations  = EXCLUDED.total_conversations,
        closed_conversations = EXCLUDED.closed_conversations,
        ai_handled           = EXCLUDED.ai_handled,
        human_handled        = EXCLUDED.human_handled,
        avg_resolution_s     = EXCLUDED.avg_resolution_s,
        csat_positive        = EXCLUDED.csat_positive,
        csat_negative        = EXCLUDED.csat_negative;

      v_count := v_count + 1;
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'date',          p_date,
    'tenants_processed', v_count
  );
END;
$$;

-- Permissão: service_role pode chamar
GRANT EXECUTE ON FUNCTION generate_metrics_daily(date) TO service_role;
