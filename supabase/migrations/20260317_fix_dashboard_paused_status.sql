-- Migration: Corrige a função get_dashboard_data removendo referência ao status 'paused'
-- Problema: "invalid input value for enum conversation_status_enum: paused"
-- Causa: A função filtrava WHERE status = 'paused' mas esse valor não existe no enum.
-- Fix: conversations_paused retorna sempre 0 (status não usado no sistema).

CREATE OR REPLACE FUNCTION get_dashboard_data(
  p_tenant_id UUID,
  p_days_ago INTEGER DEFAULT 30,
  p_channel_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP DEFAULT NULL,
  p_end_date TIMESTAMP DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_start_date TIMESTAMP;
  v_end_date TIMESTAMP;
  v_time_zone TEXT := 'America/Sao_Paulo';
  v_result JSON;
BEGIN
  IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
    v_start_date := p_start_date;
    v_end_date := p_end_date;
  ELSE
    v_end_date := CURRENT_TIMESTAMP;
    v_start_date := v_end_date - (p_days_ago || ' days')::INTERVAL;
  END IF;

  WITH

  base_conversations AS (
    SELECT
      c.id,
      c.tenant_id,
      c.contact_id,
      c.channel_id,
      c.status,
      c.ia_active,
      c.created_at,
      c.updated_at,
      c.last_message_at,
      ch.identification_number AS channel_name,
      EXTRACT(EPOCH FROM (c.updated_at - c.created_at))::INTEGER AS duration_seconds
    FROM conversations c
    LEFT JOIN channels ch ON ch.id = c.channel_id
    WHERE c.tenant_id = p_tenant_id
      AND c.created_at >= v_start_date
      AND c.created_at <= v_end_date
      AND (p_channel_id IS NULL OR c.channel_id = p_channel_id)
  ),

  messages_agg AS (
    SELECT
      m.conversation_id,
      COUNT(*) AS total_messages,
      COUNT(*) FILTER (WHERE m.sender_type = 'ai') AS ai_messages,
      COUNT(*) FILTER (WHERE m.sender_type = 'attendant') AS human_messages,
      COUNT(*) FILTER (WHERE m.sender_type = 'customer') AS customer_messages,
      MIN(m.timestamp) FILTER (WHERE m.sender_type IN ('ai', 'attendant')) AS first_response_timestamp
    FROM messages m
    WHERE EXISTS (
      SELECT 1 FROM base_conversations bc WHERE bc.id = m.conversation_id
    )
    AND m.timestamp >= v_start_date
    AND m.timestamp <= v_end_date
    GROUP BY m.conversation_id
  ),

  feedbacks_agg AS (
    SELECT
      f.conversation_id,
      COUNT(*) AS total_feedbacks,
      COUNT(*) FILTER (WHERE f.feedback_type = 'like') AS positive_feedbacks,
      COUNT(*) FILTER (WHERE f.feedback_type = 'dislike') AS negative_feedbacks
    FROM feedbacks f
    WHERE EXISTS (
      SELECT 1 FROM base_conversations bc WHERE bc.id = f.conversation_id
    )
    AND f.created_at >= v_start_date
    AND f.created_at <= v_end_date
    GROUP BY f.conversation_id
  ),

  usage_agg AS (
    SELECT
      u.id_conversation,
      SUM(u.input_tokens) AS total_input_tokens,
      SUM(u.output_tokens) AS total_output_tokens,
      SUM(u.total_tokens) AS total_tokens
    FROM usages u
    WHERE EXISTS (
      SELECT 1 FROM base_conversations bc WHERE bc.id = u.id_conversation
    )
    AND u.created_at >= v_start_date
    AND u.created_at <= v_end_date
    GROUP BY u.id_conversation
  ),

  enriched_conversations AS (
    SELECT
      bc.*,
      COALESCE(ma.total_messages, 0) AS total_messages,
      COALESCE(ma.ai_messages, 0) AS ai_messages,
      COALESCE(ma.human_messages, 0) AS human_messages,
      COALESCE(ma.customer_messages, 0) AS customer_messages,
      COALESCE(fa.total_feedbacks, 0) AS total_feedbacks,
      COALESCE(fa.positive_feedbacks, 0) AS positive_feedbacks,
      COALESCE(fa.negative_feedbacks, 0) AS negative_feedbacks,
      COALESCE(ua.total_tokens, 0) AS total_tokens,
      COALESCE(ua.total_input_tokens, 0) AS input_tokens,
      COALESCE(ua.total_output_tokens, 0) AS output_tokens,
      CASE
        WHEN ma.first_response_timestamp IS NOT NULL THEN
          EXTRACT(EPOCH FROM (ma.first_response_timestamp - bc.created_at))::INTEGER
        ELSE NULL
      END AS first_response_time_seconds
    FROM base_conversations bc
    LEFT JOIN messages_agg ma ON ma.conversation_id = bc.id
    LEFT JOIN feedbacks_agg fa ON fa.conversation_id = bc.id
    LEFT JOIN usage_agg ua ON ua.id_conversation = bc.id
  ),

  kpis AS (
    SELECT
      COUNT(*)::INTEGER AS total_conversations,
      SUM(total_messages)::BIGINT AS total_messages,
      ROUND(AVG(total_messages), 1) AS avg_messages_per_conversation,
      COUNT(*) FILTER (WHERE status = 'open')::INTEGER AS active_conversations,
      COUNT(*) FILTER (WHERE status = 'open')::INTEGER AS conversations_open,
      0::INTEGER AS conversations_paused,
      COUNT(*) FILTER (WHERE status = 'closed')::INTEGER AS conversations_closed,
      COUNT(*) FILTER (WHERE ia_active = true)::INTEGER AS conversations_with_ai,
      COUNT(*) FILTER (WHERE ia_active = false OR ia_active IS NULL)::INTEGER AS conversations_human_only,
      ROUND(
        COUNT(*) FILTER (WHERE ia_active = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
        1
      ) AS ai_percentage,
      SUM(total_feedbacks)::BIGINT AS total_feedbacks,
      SUM(positive_feedbacks)::BIGINT AS positive_feedbacks,
      SUM(negative_feedbacks)::BIGINT AS negative_feedbacks,
      ROUND(
        SUM(positive_feedbacks)::NUMERIC / NULLIF(SUM(total_feedbacks), 0) * 100,
        1
      ) AS satisfaction_rate,
      ROUND(AVG(first_response_time_seconds))::INTEGER AS avg_first_response_time_seconds,
      ROUND(AVG(duration_seconds) FILTER (WHERE status = 'closed'))::INTEGER AS avg_resolution_time_seconds,
      SUM(total_tokens)::BIGINT AS total_tokens,
      SUM(input_tokens)::BIGINT AS total_input_tokens,
      SUM(output_tokens)::BIGINT AS total_output_tokens,
      ROUND(
        (SUM(input_tokens)::NUMERIC * 3.0 / 1000000.0) +
        (SUM(output_tokens)::NUMERIC * 15.0 / 1000000.0),
        4
      ) AS estimated_cost_usd
    FROM enriched_conversations
  ),

  peak_day AS (
    SELECT
      DATE(created_at AT TIME ZONE v_time_zone) AS date,
      COUNT(*)::INTEGER AS count
    FROM enriched_conversations
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 1
  ),

  daily_conversations AS (
    SELECT
      DATE(created_at AT TIME ZONE v_time_zone) AS date,
      COUNT(*)::INTEGER AS total,
      ROUND(AVG(total_messages), 1) AS avg_messages,
      COUNT(*) FILTER (WHERE ia_active = true)::INTEGER AS with_ai,
      COUNT(*) FILTER (WHERE ia_active = false OR ia_active IS NULL)::INTEGER AS human_only
    FROM enriched_conversations
    GROUP BY 1
    ORDER BY 1
  ),

  conversations_by_tag AS (
    SELECT
      DATE(ec.created_at AT TIME ZONE v_time_zone) AS date,
      COALESCE(t.tag_name, 'Sem Tag') AS tag,
      COUNT(*)::INTEGER AS count
    FROM enriched_conversations ec
    LEFT JOIN conversation_tags ct ON ct.conversation_id = ec.id
    LEFT JOIN tags t ON t.id = ct.tag_id
    GROUP BY 1, 2
    ORDER BY 1, 2
  ),

  heatmap AS (
    SELECT
      EXTRACT(DOW FROM (created_at AT TIME ZONE v_time_zone))::INTEGER AS day_of_week,
      EXTRACT(HOUR FROM (created_at AT TIME ZONE v_time_zone))::INTEGER AS hour,
      COUNT(*)::INTEGER AS count
    FROM enriched_conversations
    GROUP BY 1, 2
    ORDER BY 1, 2
  ),

  funnel AS (
    SELECT
      conversations_open AS open,
      conversations_paused AS paused,
      conversations_closed AS closed
    FROM kpis
  ),

  by_channel AS (
    SELECT
      channel_name AS channel,
      COUNT(*)::INTEGER AS total,
      ROUND(AVG(total_messages), 1) AS avg_messages,
      ROUND(
        SUM(positive_feedbacks)::NUMERIC / NULLIF(SUM(total_feedbacks), 0) * 100,
        1
      ) AS satisfaction
    FROM enriched_conversations
    GROUP BY 1
    ORDER BY 2 DESC
  ),

  satisfaction_over_time AS (
    SELECT
      DATE(created_at AT TIME ZONE v_time_zone) AS date,
      ROUND(
        SUM(positive_feedbacks)::NUMERIC / NULLIF(SUM(total_feedbacks), 0) * 100,
        1
      ) AS satisfaction_rate,
      SUM(total_feedbacks)::INTEGER AS total_feedbacks
    FROM enriched_conversations
    WHERE total_feedbacks > 0
    GROUP BY 1
    HAVING SUM(total_feedbacks) > 0
    ORDER BY 1
  ),

  cost_over_time AS (
    SELECT
      DATE(created_at AT TIME ZONE v_time_zone) AS date,
      SUM(total_tokens)::BIGINT AS tokens,
      ROUND(
        (SUM(input_tokens)::NUMERIC * 3.0 / 1000000.0) +
        (SUM(output_tokens)::NUMERIC * 15.0 / 1000000.0),
        4
      ) AS cost
    FROM enriched_conversations
    GROUP BY 1
    ORDER BY 1
  )

  SELECT json_build_object(
    'kpis', (
      SELECT json_build_object(
        'totalConversations', COALESCE(total_conversations, 0),
        'totalMessages', COALESCE(total_messages, 0),
        'avgMessagesPerConversation', COALESCE(avg_messages_per_conversation, 0),
        'activeConversations', COALESCE(active_conversations, 0),
        'conversationsOpen', COALESCE(conversations_open, 0),
        'conversationsPaused', COALESCE(conversations_paused, 0),
        'conversationsClosed', COALESCE(conversations_closed, 0),
        'conversationsWithAi', COALESCE(conversations_with_ai, 0),
        'conversationsHumanOnly', COALESCE(conversations_human_only, 0),
        'aiPercentage', COALESCE(ai_percentage, 0),
        'totalFeedbacks', COALESCE(total_feedbacks, 0),
        'positiveFeedbacks', COALESCE(positive_feedbacks, 0),
        'negativeFeedbacks', COALESCE(negative_feedbacks, 0),
        'satisfactionRate', COALESCE(satisfaction_rate, 0),
        'avgFirstResponseTimeSeconds', avg_first_response_time_seconds,
        'avgResolutionTimeSeconds', avg_resolution_time_seconds,
        'totalTokens', COALESCE(total_tokens, 0),
        'totalInputTokens', COALESCE(total_input_tokens, 0),
        'totalOutputTokens', COALESCE(total_output_tokens, 0),
        'estimatedCostUsd', COALESCE(estimated_cost_usd, 0),
        'peakDay', (
          SELECT json_build_object('date', date, 'count', count)
          FROM peak_day
        )
      )
      FROM kpis
    ),
    'dailyConversations', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'date', date,
          'total', total,
          'avgMessages', avg_messages,
          'withAI', with_ai,
          'humanOnly', human_only
        ) ORDER BY date
      ), '[]'::json)
      FROM daily_conversations
    ),
    'conversationsByTag', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'date', date,
          'tag', tag,
          'count', count
        ) ORDER BY date, tag
      ), '[]'::json)
      FROM conversations_by_tag
    ),
    'heatmap', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'dayOfWeek', day_of_week,
          'hour', hour,
          'count', count
        )
      ), '[]'::json)
      FROM heatmap
    ),
    'funnel', (SELECT row_to_json(funnel.*) FROM funnel),
    'byChannel', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'channel', channel,
          'total', total,
          'avgMessages', avg_messages,
          'satisfaction', satisfaction
        ) ORDER BY total DESC
      ), '[]'::json)
      FROM by_channel
    ),
    'satisfactionOverTime', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'date', date,
          'satisfactionRate', satisfaction_rate,
          'totalFeedbacks', total_feedbacks
        ) ORDER BY date
      ), '[]'::json)
      FROM satisfaction_over_time
    ),
    'costOverTime', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'date', date,
          'tokens', tokens,
          'cost', cost
        ) ORDER BY date
      ), '[]'::json)
      FROM cost_over_time
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;
