-- Adiciona coluna connection_status na tabela channels para rastrear
-- o estado de conexão em tempo real de cada canal (ex: WhatsApp via Evolution API).

ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS connection_status text
    NOT NULL DEFAULT 'unknown'
    CHECK (connection_status IN ('connected', 'disconnected', 'connecting', 'unknown'));

COMMENT ON COLUMN public.channels.connection_status IS
  'Estado de conexão do canal com o provedor externo. '
  'Atualizado via webhook da Evolution API e polling de fallback. '
  'Valores: connected | disconnected | connecting | unknown';
