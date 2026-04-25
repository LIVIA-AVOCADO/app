-- Migration: Social Login Schema
-- Prepara tabela users para auto-registro via Google OAuth

-- whatsapp_number nao sera preenchido no auto-registro via Google
ALTER TABLE public.users ALTER COLUMN whatsapp_number SET DEFAULT '';
ALTER TABLE public.users ALTER COLUMN whatsapp_number DROP NOT NULL;

-- Codigo de 6 caracteres para associacao admin<->usuario
-- NULL para usuarios ja associados; preenchido apenas no auto-registro
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invite_code VARCHAR(10) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON public.users(invite_code) WHERE invite_code IS NOT NULL;
