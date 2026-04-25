-- ============================================================
-- Migration: Atualiza wizard_schema dos templates
-- Adiciona todos os steps implementados ao template Geral
-- ============================================================

UPDATE onboarding.onboarding_templates
SET
  wizard_schema = '[
    {"key": "company",            "title": "Empresa",               "description": "Dados da empresa e responsáveis",          "required": true},
    {"key": "business_profile",   "title": "Perfil do Negócio",     "description": "Descrição, público-alvo e regiões",        "required": false},
    {"key": "catalog",            "title": "Catálogo",              "description": "Produtos e serviços oferecidos",           "required": false},
    {"key": "faq",                "title": "FAQ",                   "description": "Perguntas e respostas frequentes",         "required": false},
    {"key": "service",            "title": "Atendimento",           "description": "Tom de voz e tópicos proibidos",           "required": false},
    {"key": "script",             "title": "Roteiro",               "description": "Etapas do fluxo de conversa",             "required": false},
    {"key": "knowledge",          "title": "Base de Conhecimento",  "description": "Base de conhecimento do agente",           "required": false},
    {"key": "agent",              "title": "Agente IA",             "description": "Nome, tipo e personalidade do agente",     "required": true},
    {"key": "ai_operation",       "title": "Operação de IA",        "description": "Prompts internos e guardrails",            "required": false},
    {"key": "conversation_rules", "title": "Regras",                "description": "Timeout e regras de reativação",          "required": false},
    {"key": "tags",               "title": "Tags",                  "description": "Tags para classificar conversas",          "required": false}
  ]'::jsonb,
  updated_at = now()
WHERE niche = 'Geral';
