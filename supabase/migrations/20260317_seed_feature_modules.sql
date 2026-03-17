-- Popula feature_modules com os módulos do sistema LIVIA.
-- As chaves (key) devem coincidir com MODULE_KEYS em lib/permissions/index.ts.

INSERT INTO public.feature_modules (key, name, description, icon)
VALUES
  ('livechat',       'Livechat',              'Acesso à caixa de entrada e atendimento de conversas', 'MessageSquare'),
  ('crm',            'CRM',                   'Gestão de contatos e funil de vendas', 'Kanban'),
  ('knowledge-base', 'Base de Conhecimento',  'Gerenciamento de bases e validação de respostas da IA', 'BookOpen'),
  ('agents',         'Agentes IA',            'Criação e configuração de agentes de inteligência artificial', 'Bot'),
  ('reativacao',     'Reativação',            'Regras e configurações de reativação automática de conversas', 'RefreshCw'),
  ('configuracoes',  'Configurações',         'Tags, controle da IA e demais configurações do workspace', 'Settings')
ON CONFLICT (key) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      icon        = EXCLUDED.icon,
      updated_at  = now();
