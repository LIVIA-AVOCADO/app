-- Adiciona o módulo 'horarios_agente' à tabela feature_modules.
-- A chave deve coincidir com MODULE_KEYS.HORARIOS_AGENTE em lib/permissions/index.ts.

INSERT INTO public.feature_modules (key, name, description, icon)
VALUES (
  'horarios_agente',
  'Horários do Agente',
  'Configuração dos horários de disponibilidade do agente de IA',
  'Clock'
)
ON CONFLICT (key) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      icon        = EXCLUDED.icon,
      updated_at  = now();
