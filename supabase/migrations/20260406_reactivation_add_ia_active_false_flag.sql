-- Migration: adiciona campo reactivate_when_ia_active_false na tabela tenant_reactivation_settings
-- Feature: permite configurar se o fluxo de reativacao tambem processa conversas com ia_active = false

ALTER TABLE tenant_reactivation_settings
  ADD COLUMN IF NOT EXISTS reactivate_when_ia_active_false BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tenant_reactivation_settings.reactivate_when_ia_active_false IS
  'Quando true, o fluxo de reativacao tambem processa conversas onde ia_active = false (atendimento humano). O fluxo NAO altera ia_active ao reativar.';
