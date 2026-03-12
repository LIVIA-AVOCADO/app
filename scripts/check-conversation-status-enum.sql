-- Consulta os valores atuais do enum conversation_status_enum no banco
SELECT
  t.typname     AS enum_name,
  e.enumlabel   AS enum_value,
  e.enumsortorder AS sort_order
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'conversation_status_enum'
ORDER BY e.enumsortorder;
