-- ============================================================
-- MIGRATION: CRM — Campos customizados de contato + Notas
-- ============================================================

-- Definições de campos customizados por tenant
CREATE TABLE contact_field_definitions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  field_key     text NOT NULL,
  field_label   text NOT NULL,
  field_type    text NOT NULL CHECK (field_type IN ('text','number','date','select','boolean')),
  options       jsonb,
  is_required   boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, field_key)
);

CREATE INDEX ON contact_field_definitions (tenant_id, display_order);

-- Valores dos campos para cada contato
CREATE TABLE contact_field_values (
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL,
  field_key   text NOT NULL,
  value       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, field_key)
);

CREATE INDEX ON contact_field_values (tenant_id, field_key);

-- Notas internas sobre contatos
CREATE TABLE contact_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON contact_notes (contact_id, created_at DESC);
CREATE INDEX ON contact_notes (tenant_id);

ALTER TABLE contact_notes REPLICA IDENTITY FULL;

-- RLS
ALTER TABLE contact_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_field_values      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes             ENABLE ROW LEVEL SECURITY;
