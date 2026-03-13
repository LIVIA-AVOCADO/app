-- Trigger: auto-atualiza conversations.last_message_at em toda inserção de mensagem.
-- Necessário para que o Realtime dispare UPDATE events em respostas da IA,
-- não apenas em mensagens do cliente (que já eram atualizadas pelo n8n).

CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.timestamp,
      updated_at = NOW()
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR last_message_at < NEW.timestamp);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_last_message_at
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message_at();
