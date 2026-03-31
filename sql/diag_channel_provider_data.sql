-- ============================================================
-- Diagnóstico: verificar dados de channel_providers
-- ============================================================
-- Rode este SQL no Supabase SQL Editor para validar
-- se id_subwork_n8n_master_integrator está populado.
-- ============================================================

-- 1. Listar todos os providers e seus campos críticos
SELECT
  id,
  name,
  channel_provider_identifier_code,
  id_subwork_n8n_master_integrator,
  CASE
    WHEN id_subwork_n8n_master_integrator IS NULL THEN '⚠️  NULL — precisa preencher!'
    ELSE '✅ OK'
  END AS status_master_integrator
FROM public.channel_providers
ORDER BY name;

-- 2. Verificar canais ativos e seus providers (simula o que a RPC retorna)
SELECT
  c.id AS channel_id,
  c.name AS channel_name,
  c.config_json->>'instance_name' AS instance_name,
  c.config_json->>'instance_id_api' AS instance_id_api,
  c.is_active,
  cp.channel_provider_identifier_code,
  cp.id_subwork_n8n_master_integrator
FROM public.channels c
INNER JOIN public.channel_providers cp ON cp.id = c.channel_provider_id
WHERE c.is_active = true
ORDER BY c.name;

-- 3. Testar a RPC atualizada (substitua 'NOME_DA_INSTANCIA' pelo nome real)
-- SELECT * FROM public.get_channel_evolution_by_instance_id('NOME_DA_INSTANCIA');
