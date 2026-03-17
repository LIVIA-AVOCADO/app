-- Adiciona coluna para registrar quando o usuário aceitou os termos de serviço
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- Comentário explicativo
COMMENT ON COLUMN public.users.terms_accepted_at IS
  'Timestamp de quando o usuário aceitou os Termos de Serviço e Política de Privacidade. NULL = ainda não aceitou.';
