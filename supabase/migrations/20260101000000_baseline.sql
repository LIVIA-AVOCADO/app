-- ============================================================
-- BASELINE MÍNIMO — schema de produção capturado em 2026-04-25
-- Contém apenas o necessário para as migrations rodarem.
-- db pull detectará funções/indexes/FKs/políticas como drift.
-- NÃO editar manualmente.
-- ============================================================

-- 0. SCHEMAS
-- ============================================================
CREATE SCHEMA IF NOT EXISTS onboarding;

-- 0b. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 0c. SEQUENCES
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.agent_guard_rails_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1;
CREATE SEQUENCE IF NOT EXISTS public.agent_observer_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1;
CREATE SEQUENCE IF NOT EXISTS public.agent_prompts_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1;
CREATE SEQUENCE IF NOT EXISTS public.agent_prompts_intention_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1;
CREATE SEQUENCE IF NOT EXISTS public.fx_usd_brl_history_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1;
CREATE SEQUENCE IF NOT EXISTS public.usages_id_seq INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1;

-- 1. ENUMS
-- ============================================================
CREATE TYPE public.access_user_role AS ENUM ('super_admin', 'user');
CREATE TYPE public.address_type AS ENUM ('ESTADO', 'CIDADE', 'BAIRRO', 'CEP_FAIXA', 'CEP_UNICO', 'LOGRADOURO', 'CONDOMINIO', 'REGIAO');
CREATE TYPE public.agent_function AS ENUM ('attendant', 'intention', 'in_guard_rails', 'observer', 'internal_system');
CREATE TYPE public.agent_function_enum AS ENUM ('support', 'sales', 'after_sales', 'research', 'internal_system');
CREATE TYPE public.agent_gender_enum AS ENUM ('male', 'female');
CREATE TYPE public.agent_type_enum AS ENUM ('in_guard_rails', 'intention', 'attendant', 'observer', 'internal_system');
CREATE TYPE public.attachment_type_enum AS ENUM ('audio', 'image', 'document', 'video');
CREATE TYPE public.commercial_policy_type AS ENUM ('trial_extension', 'credit_bonus', 'plan_discount', 'package_discount', 'campaign');
CREATE TYPE public.contact_status_enum AS ENUM ('open', 'with_ai', 'paused', 'closed');
CREATE TYPE public.conversation_status_enum AS ENUM ('open', 'closed');
CREATE TYPE public.feedback_process_status_enum AS ENUM ('open', 'in_progress', 'closed');
CREATE TYPE public.feedback_type_enum AS ENUM ('like', 'dislike');
CREATE TYPE public.message_sender_type_enum AS ENUM ('customer', 'attendant', 'ai', 'channel');
CREATE TYPE public.message_status AS ENUM ('pending', 'sent', 'failed', 'read');
CREATE TYPE public.message_type_enum AS ENUM ('text', 'audio', 'image');
CREATE TYPE public.message_visibility_enum AS ENUM ('public', 'internal');
CREATE TYPE public.reactivation_action_type AS ENUM ('transfer_to_human', 'send_message', 'send_audio', 'close_conversation');
CREATE TYPE public.reason_type_enum AS ENUM ('pause', 'closure');
CREATE TYPE public.synapse_status_enum AS ENUM ('draft', 'indexing', 'publishing', 'error');
CREATE TYPE public.tag_type AS ENUM ('description', 'success', 'fail');
CREATE TYPE public.tenant_reactivation_fallback_action AS ENUM ('end_conversation', 'pause_ai', 'do_nothing', 'transfer_to_human');
CREATE TYPE public.transcription_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE public.usage_types AS ENUM ('text', 'audio_send', 'audio_listen', 'file_extract_data', 'image_extract_data', 'analisys', 'guard_rails', 'intention', 'parser_out', 'aux_tools', 'reactivation_text', 'reactivation_audio');

-- 2a. TABLES — public
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_prompts (
    id bigint NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    name text,
    age text,
    gender agent_gender_enum,
    objective text,
    comunication text,
    personality text,
    limitations jsonb DEFAULT '[{"sub": [{"active": true, "content": ""}], "type": "markdown", "title": "", "active": true}]'::jsonb,
    rules jsonb DEFAULT '[{"sub": [{"active": true, "content": ""}], "type": "markdown", "title": "", "active": true}]'::jsonb,
    instructions jsonb DEFAULT '[{"sub": [{"active": true, "content": ""}], "type": "markdown", "title": "", "active": true}]'::jsonb,
    guide_line jsonb DEFAULT '[{"sub": [{"active": true, "content": ""}], "type": "markdown", "title": "", "active": true}]'::jsonb,
    others_instructions jsonb DEFAULT '[{"sub": [{"active": true, "content": ""}], "type": "markdown", "title": "", "active": true}]'::jsonb,
    id_agent uuid,
    id_tenant uuid
);

CREATE TABLE IF NOT EXISTS public.agent_prompts_deleted_backup (
    backup_date timestamp with time zone,
    id bigint,
    created_at timestamp with time zone,
    name text,
    age text,
    gender agent_gender_enum,
    objective text,
    comunication text,
    personality text,
    limitations jsonb,
    rules jsonb,
    instructions jsonb,
    guide_line jsonb,
    others_instructions jsonb,
    id_agent uuid,
    id_tenant uuid
);

CREATE TABLE IF NOT EXISTS public.agent_prompts_guard_rails (
    id bigint NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    prompt_jailbreak text,
    prompt_nsfw text,
    id_agent uuid,
    id_tenant uuid
);

CREATE TABLE IF NOT EXISTS public.agent_prompts_intention (
    id bigint NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    prompt text,
    id_agent uuid,
    id_tenant uuid
);

CREATE TABLE IF NOT EXISTS public.agent_prompts_internal_system (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    prompt text,
    id_agent uuid NOT NULL DEFAULT gen_random_uuid(),
    id_tenant uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agent_prompts_observer (
    id bigint NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    prompt text,
    id_tenant uuid,
    id_agent uuid
);

CREATE TABLE IF NOT EXISTS public.agent_schedule_exceptions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    exception_date date NOT NULL,
    type text NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    label text,
    timezone text NOT NULL DEFAULT 'America/Sao_Paulo'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_schedule_weekly (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    offline_message text,
    timezone text NOT NULL DEFAULT 'America/Sao_Paulo'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type agent_function NOT NULL,
    reactive boolean NOT NULL DEFAULT true,
    persona_name text,
    age text,
    gender text,
    objective text,
    communication text,
    personality text,
    limitations jsonb,
    rules jsonb,
    instructions jsonb,
    guide_line jsonb,
    others_instructions jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agents (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying NOT NULL,
    type agent_type_enum NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    id_neurocore uuid,
    reactive boolean NOT NULL DEFAULT true,
    template_id uuid
);

CREATE TABLE IF NOT EXISTS public.ai_models (
    model text NOT NULL,
    input_usd_per_1m numeric(12,6) NOT NULL,
    output_usd_per_1m numeric(12,6) NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.attendants (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    type text NOT NULL,
    user_id uuid,
    ai_name text,
    n8n_webhook_path text,
    team_id uuid,
    skills text[] NOT NULL DEFAULT '{}'::text[],
    max_concurrent integer NOT NULL DEFAULT 10,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auto_recharge_configs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    threshold_credits integer NOT NULL,
    recharge_amount_cents integer NOT NULL,
    stripe_payment_method_id text NOT NULL,
    card_last4 text,
    card_brand text,
    last_triggered_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.base_conhecimento_google_files (
    id_base_conhecimento_google_files uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    id_base_conhecimento_google_store uuid NOT NULL,
    titulo text NOT NULL,
    texto text NOT NULL,
    ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.base_conhecimento_google_store (
    id_base_conhecimento_google_store uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    tenant_id uuid NOT NULL,
    url text NOT NULL,
    google_api_key text NOT NULL,
    display_name text NOT NULL,
    name_store text
);

CREATE TABLE IF NOT EXISTS public.base_conhecimentos (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name character varying NOT NULL,
    description text,
    neurocore_id uuid NOT NULL,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    url_attachment text,
    base_conhecimentos_vectors uuid,
    domain uuid
);

CREATE TABLE IF NOT EXISTS public.base_conhecimentos_vectors (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    content text,
    metadata jsonb,
    embedding vector(1536),
    base_conhecimentos_id uuid,
    tenant_id uuid
);

CREATE TABLE IF NOT EXISTS public.billing_notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    severity text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    channels text[] NOT NULL DEFAULT '{whatsapp,email}'::text[],
    status text NOT NULL DEFAULT 'pending'::text,
    tries integer NOT NULL DEFAULT 0,
    last_error text,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    sent_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.channel_providers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying NOT NULL,
    description text,
    api_base_config jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    channel_provider_identifier_code text,
    id_subwork_n8n_master_integrator text,
    channel_type_id uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS public.channel_types (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    display_name text NOT NULL,
    icon text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.channels (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    channel_provider_id uuid NOT NULL,
    name character varying NOT NULL,
    identification_number character varying NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    is_receiving_messages boolean NOT NULL DEFAULT true,
    is_sending_messages boolean NOT NULL DEFAULT true,
    observations text,
    config_json jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    message_wait_time_fragments integer DEFAULT 8,
    connection_status text NOT NULL DEFAULT 'unknown'::text,
    provider_external_channel_id text,
    instance_company_name text,
    identification_channel_client_descriptions text,
    external_api_url text
);

CREATE TABLE IF NOT EXISTS public.commercial_policies (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    type commercial_policy_type NOT NULL,
    tenant_id uuid,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    trial_days_extension integer,
    credit_bonus_amount integer,
    discount_percent numeric(5,2),
    target_package_id uuid,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_data_changes (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    field_name text NOT NULL,
    old_value text,
    new_value text,
    changed_by uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contacts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name character varying NOT NULL,
    phone character varying NOT NULL,
    phone_secondary character varying,
    email character varying,
    country character varying,
    city character varying,
    zip_code character varying,
    address_street character varying,
    address_number character varying,
    address_complement character varying,
    cpf character varying,
    rg character varying,
    last_interaction_at timestamp with time zone NOT NULL DEFAULT now(),
    status contact_status_enum NOT NULL,
    customer_data_extracted jsonb,
    last_negotiation jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    external_identification_contact text,
    external_contact_id text,
    is_muted boolean NOT NULL DEFAULT false,
    muted_at timestamp with time zone,
    muted_by uuid,
    mute_reason text
);

CREATE TABLE IF NOT EXISTS public.conversation_assignments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    attendant_id uuid,
    team_id uuid,
    assigned_by uuid,
    reason text,
    rule_id uuid,
    assigned_at timestamp with time zone NOT NULL DEFAULT now(),
    unassigned_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.conversation_followups (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    message text,
    ai_generate boolean NOT NULL DEFAULT false,
    cancel_on_reply boolean NOT NULL DEFAULT true,
    is_done boolean NOT NULL DEFAULT false,
    done_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_queue (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    target_team_id uuid,
    target_type text NOT NULL DEFAULT 'any'::text,
    queued_at timestamp with time zone NOT NULL DEFAULT now(),
    auto_assign_at timestamp with time zone,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.conversation_reasons_pauses_and_closures (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    reason_type reason_type_enum NOT NULL,
    neurocore_id uuid NOT NULL,
    description text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_tags (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contact_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    channel_id uuid,
    external_id character varying,
    status conversation_status_enum NOT NULL,
    ia_active boolean NOT NULL DEFAULT true,
    last_message_at timestamp with time zone NOT NULL DEFAULT now(),
    overall_feedback_type feedback_type_enum,
    overall_feedback_text text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    conversation_pause_reason_id uuid,
    pause_notes text,
    conversation_closure_reason_id uuid,
    closure_notes text,
    consecutive_reactivations integer NOT NULL DEFAULT 0,
    total_reactivations integer NOT NULL DEFAULT 0,
    has_unread boolean NOT NULL DEFAULT false,
    unread_count integer NOT NULL DEFAULT 0,
    is_important boolean NOT NULL DEFAULT false,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    team_id uuid
);

CREATE TABLE IF NOT EXISTS public.credit_packages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    label text,
    description text,
    price_brl_cents integer NOT NULL,
    credits integer NOT NULL,
    bonus_credits integer NOT NULL DEFAULT 0,
    stripe_product_id text,
    stripe_price_id text,
    is_active boolean NOT NULL DEFAULT true,
    is_highlighted boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feature_modules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    key character varying NOT NULL,
    name character varying NOT NULL,
    description text NOT NULL,
    icon character varying NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feedbacks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    message_id uuid,
    feedback_type feedback_type_enum NOT NULL,
    feedback_text text,
    feedback_status feedback_process_status_enum NOT NULL DEFAULT 'open'::feedback_process_status_enum,
    super_admin_comment text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fx_usd_brl_history (
    id bigint NOT NULL DEFAULT nextval('fx_usd_brl_history_id_seq'::regclass),
    rate numeric NOT NULL,
    source text,
    fetched_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_actions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    integration_slug text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_catalog (
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    logo_url text,
    documentation_url text,
    config_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_domains (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    domain text NOT NULL,
    neurocore_id uuid NOT NULL,
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.knowledge_entity_links (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    base_conhecimento_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    wallet_id uuid NOT NULL,
    direction text NOT NULL,
    amount_credits bigint NOT NULL,
    balance_after bigint NOT NULL,
    source_type text NOT NULL,
    source_ref text,
    usage_id bigint,
    description text,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.markup_rules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid,
    provider text,
    sku text,
    agent_id uuid,
    multiplier numeric NOT NULL DEFAULT 1.0,
    fixed_usd numeric NOT NULL DEFAULT 0.0,
    priority integer NOT NULL DEFAULT 100,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_attachments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    message_id uuid NOT NULL,
    attachment_type attachment_type_enum NOT NULL,
    storage_bucket text NOT NULL,
    storage_path text NOT NULL,
    file_name text,
    mime_type text,
    file_size_bytes bigint,
    duration_ms integer,
    width integer,
    height integer,
    provider_media_id text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_feedback (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL,
    message_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    rating text NOT NULL,
    comment text,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    sender_type message_sender_type_enum NOT NULL,
    sender_user_id uuid,
    sender_agent_id uuid,
    content text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL DEFAULT now(),
    feedback_type feedback_type_enum,
    feedback_text text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    external_message_id text,
    status message_status DEFAULT 'pending'::message_status,
    message_type message_type_enum NOT NULL DEFAULT 'text'::message_type_enum,
    visibility message_visibility_enum NOT NULL DEFAULT 'public'::message_visibility_enum,
    transcription_status transcription_status_enum NOT NULL DEFAULT 'completed'::transcription_status_enum,
    sender_channel_id uuid,
    quoted_message_id uuid
);

CREATE TABLE IF NOT EXISTS public.mp_pix_payments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    mp_payment_id text NOT NULL,
    payment_type text NOT NULL DEFAULT 'credit_purchase'::text,
    status text NOT NULL DEFAULT 'pending'::text,
    amount_cents integer NOT NULL,
    credits integer NOT NULL DEFAULT 0,
    qr_code text,
    qr_code_base64 text,
    expires_at timestamp with time zone,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.neurocores (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying NOT NULL,
    description text,
    id_subwork_n8n_neurocore character varying NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.niche_channel_defaults (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    niche_id uuid NOT NULL,
    channel_type_id uuid NOT NULL,
    channel_provider_id uuid NOT NULL,
    neurocore_id uuid NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.niches (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_admins (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_configs (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_component_prices (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    component_id uuid NOT NULL,
    usd_per_unit numeric NOT NULL,
    effective_range tstzrange NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_components (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    sku_id uuid NOT NULL,
    measure_key text NOT NULL,
    unit_multiplier numeric NOT NULL DEFAULT 1.0,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_skus (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    sku text NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quick_reply_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    title character varying NOT NULL,
    message text NOT NULL,
    icon character varying,
    usage_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    active boolean NOT NULL DEFAULT true,
    created_by uuid
);

CREATE TABLE IF NOT EXISTS public.sched_appointment_resource_allocations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    appointment_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sched_appointment_services (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    appointment_id uuid NOT NULL,
    service_id uuid NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sched_appointments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    unit_id uuid,
    channel_id uuid,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    hold_expires_at timestamp with time zone,
    status text NOT NULL DEFAULT 'pending'::text,
    source text NOT NULL DEFAULT 'manual'::text,
    notes text,
    created_by_user_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sched_availability_exceptions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    resource_id uuid,
    unit_id uuid,
    exception_type text NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    reason text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sched_availability_windows (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sched_resources (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    unit_id uuid,
    resource_type text NOT NULL,
    name text NOT NULL,
    user_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sched_service_resource_requirements (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    service_id uuid NOT NULL,
    required_resource_type text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    is_mandatory boolean NOT NULL DEFAULT true,
    preferred_unit_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sched_services (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    service_type text NOT NULL DEFAULT 'generic'::text,
    description text,
    duration_minutes integer NOT NULL,
    buffer_before_minutes integer NOT NULL DEFAULT 0,
    buffer_after_minutes integer NOT NULL DEFAULT 0,
    price_cents integer,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sched_settings (
    tenant_id uuid NOT NULL,
    allow_customer_choose_professional boolean NOT NULL DEFAULT true,
    allow_any_available_professional boolean NOT NULL DEFAULT true,
    min_notice_minutes integer NOT NULL DEFAULT 60,
    max_booking_window_days integer NOT NULL DEFAULT 60,
    slot_granularity_minutes integer NOT NULL DEFAULT 10,
    hold_duration_minutes integer NOT NULL DEFAULT 10,
    availability_mode text NOT NULL DEFAULT 'hybrid'::text,
    automation_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sched_units (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    address_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    timezone text NOT NULL DEFAULT 'America/Fortaleza'::text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_checkout_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    stripe_session_id text NOT NULL,
    mode text NOT NULL,
    amount_cents integer,
    status text NOT NULL DEFAULT 'pending'::text,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    refunded_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    stripe_price_id text NOT NULL,
    name text NOT NULL,
    description text,
    price_brl integer NOT NULL,
    "interval" text NOT NULL,
    features jsonb DEFAULT '[]'::jsonb,
    credits_included integer DEFAULT 0,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    stripe_product_id text
);

CREATE TABLE IF NOT EXISTS public.tag_triggers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    tenant_integration_id uuid NOT NULL,
    action_id uuid NOT NULL,
    custom_config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tags (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    tag_name text NOT NULL,
    prompt_to_ai text,
    active boolean DEFAULT true,
    order_index integer NOT NULL DEFAULT 0,
    color text NOT NULL DEFAULT '#3b82f6'::text,
    is_category boolean DEFAULT false,
    tag_type tag_type DEFAULT 'description'::tag_type,
    change_conversation_status conversation_status_enum,
    id_neurocore uuid,
    tenant_id uuid,
    send_text_message text,
    send_text boolean NOT NULL DEFAULT false,
    pause_ia_on_apply boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.team_members (
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL DEFAULT 'agent'::text,
    skills text[] NOT NULL DEFAULT '{}'::text[],
    is_available boolean NOT NULL DEFAULT true,
    max_concurrent_conversations integer NOT NULL DEFAULT 10,
    joined_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teams (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    color text NOT NULL DEFAULT '#6366f1'::text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_conversation_timeout_settings (
    tenant_id uuid NOT NULL,
    ia_inactive_timeout_minutes integer,
    closure_message text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_integrations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    integration_slug text NOT NULL,
    name text,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_reactivation_rules_steps (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    sequence integer NOT NULL DEFAULT 1,
    wait_time_minutes integer NOT NULL,
    action_type reactivation_action_type NOT NULL,
    action_parameter text,
    start_time time without time zone,
    end_time time without time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_reactivation_rules_steps_tags (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    reactivation_rule_step_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_reactivation_settings (
    tenant_id uuid NOT NULL,
    exhausted_action tenant_reactivation_fallback_action NOT NULL DEFAULT 'end_conversation'::tenant_reactivation_fallback_action,
    exhausted_message text DEFAULT 'Conversa encerrada devido inatividade, suas próximas interações serão uma nova conversa'::text,
    max_reactivation_window_minutes integer DEFAULT 1440,
    max_window_action tenant_reactivation_fallback_action NOT NULL DEFAULT 'end_conversation'::tenant_reactivation_fallback_action,
    max_window_message text DEFAULT 'Conversa encerrada devido inatividade, suas próximas interações serão uma nova conversa'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    reactivate_when_ia_active_false boolean NOT NULL DEFAULT false,
    reactivate_only_after_first_human_message boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying NOT NULL,
    neurocore_id uuid NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    cnpj character varying NOT NULL,
    phone character varying NOT NULL,
    responsible_tech_name character varying NOT NULL,
    responsible_tech_whatsapp character varying NOT NULL,
    responsible_tech_email character varying NOT NULL,
    responsible_finance_name character varying NOT NULL,
    responsible_finance_whatsapp character varying NOT NULL,
    responsible_finance_email character varying NOT NULL,
    plan character varying NOT NULL,
    master_integration_active boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    niche_id uuid,
    ia_active boolean DEFAULT true,
    id_contato_testes uuid,
    id_conversas_testes uuid,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'inactive'::text,
    subscription_current_period_end timestamp with time zone,
    subscription_cancel_at_period_end boolean DEFAULT false,
    subscription_provider text NOT NULL DEFAULT 'stripe'::text,
    subscription_billing_day integer
);

CREATE TABLE IF NOT EXISTS public.ura_configs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    mode text NOT NULL DEFAULT 'direct'::text,
    default_ai_attendant_id uuid,
    business_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
    outside_hours_action text NOT NULL DEFAULT 'queue'::text,
    outside_hours_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ura_rules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    priority integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
    action_type text NOT NULL,
    action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usages (
    id bigint NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    model character varying,
    input_tokens integer,
    output_tokens integer,
    total_tokens integer,
    workflow_id character varying,
    execution_id integer,
    id_tenant uuid,
    id_contact uuid,
    id_agent uuid,
    id_conversation uuid,
    usage_type usage_types,
    elevenlabs_character_cost integer,
    elevenlabs_tts_latency_ms bigint,
    elevenlabs_request_id text,
    elevenlabs_history_item_id text,
    elevenlabs_xregion text,
    provider text,
    sku text,
    measures jsonb,
    base_usd numeric,
    sell_usd numeric,
    fx_used numeric,
    debited_credits bigint
);

CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL,
    tenant_id uuid,
    full_name character varying NOT NULL,
    email character varying NOT NULL,
    whatsapp_number character varying DEFAULT ''::character varying,
    role access_user_role NOT NULL DEFAULT 'user'::access_user_role,
    avatar_url text,
    is_active boolean NOT NULL DEFAULT true,
    last_sign_in_at timestamp with time zone,
    modules text[] NOT NULL DEFAULT '{}'::text[],
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    ai_paused boolean NOT NULL DEFAULT false,
    invite_code character varying(10),
    terms_accepted_at timestamp with time zone,
    availability_status text NOT NULL DEFAULT 'offline'::text,
    availability_updated_at timestamp with time zone,
    is_internal boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.wallets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    balance_credits bigint NOT NULL DEFAULT 0,
    overdraft_percent numeric NOT NULL DEFAULT 0.10,
    low_balance_threshold_credits bigint NOT NULL DEFAULT 5000,
    notify_low_balance boolean NOT NULL DEFAULT true,
    notify_hard_stop boolean NOT NULL DEFAULT true,
    hard_stop_active boolean NOT NULL DEFAULT false,
    last_low_balance_notified_at timestamp with time zone,
    last_hard_stop_notified_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2b. TABLES — onboarding
-- ============================================================
CREATE TABLE IF NOT EXISTS onboarding.onboarding_async_jobs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    job_type text NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    result jsonb,
    n8n_webhook_url text,
    attempts integer NOT NULL DEFAULT 0,
    last_attempt_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding.onboarding_channel_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    qr_code text,
    phone_number text,
    whatsapp_id text,
    n8n_job_id text,
    connected_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding.onboarding_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    niche text NOT NULL,
    description text,
    default_neurocore_id uuid NOT NULL,
    wizard_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
    default_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    activation_rules jsonb NOT NULL DEFAULT '{"required_steps": ["company", "agent"]}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    niche_id uuid
);

CREATE TABLE IF NOT EXISTS onboarding.tenant_onboarding_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL,
    created_by uuid NOT NULL,
    tenant_id uuid,
    status text NOT NULL DEFAULT 'draft'::text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    current_step text,
    completed_steps text[] NOT NULL DEFAULT '{}'::text[],
    error_message text,
    activated_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. PRIMARY KEYS & UNIQUE CONSTRAINTS
-- ============================================================
ALTER TABLE public.agent_prompts ADD CONSTRAINT agent_prompts_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_prompts_guard_rails ADD CONSTRAINT agent_guard_rails_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_prompts_intention ADD CONSTRAINT agent_prompts_intention_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_prompts_internal_system ADD CONSTRAINT agent_prompts_internal_system_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_prompts_observer ADD CONSTRAINT agent_observer_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_schedule_exceptions ADD CONSTRAINT agent_schedule_exceptions_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_schedule_weekly ADD CONSTRAINT agent_schedule_weekly_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_templates ADD CONSTRAINT agent_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.agents ADD CONSTRAINT agents_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_models ADD CONSTRAINT ai_models_pkey PRIMARY KEY (model);
ALTER TABLE public.attendants ADD CONSTRAINT attendants_pkey PRIMARY KEY (id);
ALTER TABLE public.auto_recharge_configs ADD CONSTRAINT auto_recharge_configs_pkey PRIMARY KEY (id);
ALTER TABLE public.base_conhecimento_google_files ADD CONSTRAINT base_conhecimento_google_files_pkey PRIMARY KEY (id_base_conhecimento_google_files);
ALTER TABLE public.base_conhecimento_google_store ADD CONSTRAINT base_conhecimento_google_store_pkey PRIMARY KEY (id_base_conhecimento_google_store);
ALTER TABLE public.base_conhecimentos ADD CONSTRAINT base_conhecimentos_pkey PRIMARY KEY (id);
ALTER TABLE public.base_conhecimentos_vectors ADD CONSTRAINT base_conhecimentos_vectors_pkey PRIMARY KEY (id);
ALTER TABLE public.billing_notifications ADD CONSTRAINT billing_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.channel_providers ADD CONSTRAINT channel_providers_pkey PRIMARY KEY (id);
ALTER TABLE public.channel_types ADD CONSTRAINT channel_types_pkey PRIMARY KEY (id);
ALTER TABLE public.channels ADD CONSTRAINT channels_pkey PRIMARY KEY (id);
ALTER TABLE public.commercial_policies ADD CONSTRAINT commercial_policies_pkey PRIMARY KEY (id);
ALTER TABLE public.contact_data_changes ADD CONSTRAINT contact_data_changes_pkey PRIMARY KEY (id);
ALTER TABLE public.contacts ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.conversation_assignments ADD CONSTRAINT conversation_assignments_pkey PRIMARY KEY (id);
ALTER TABLE public.conversation_followups ADD CONSTRAINT conversation_followups_pkey PRIMARY KEY (id);
ALTER TABLE public.conversation_queue ADD CONSTRAINT conversation_queue_pkey PRIMARY KEY (id);
ALTER TABLE public.conversation_reasons_pauses_and_closures ADD CONSTRAINT conversation_reasons_pauses_and_closures_pkey PRIMARY KEY (id);
ALTER TABLE public.conversation_tags ADD CONSTRAINT conversation_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.conversations ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
ALTER TABLE public.credit_packages ADD CONSTRAINT credit_packages_pkey PRIMARY KEY (id);
ALTER TABLE public.feature_modules ADD CONSTRAINT feature_modules_pkey PRIMARY KEY (id);
ALTER TABLE public.feedbacks ADD CONSTRAINT feedbacks_pkey PRIMARY KEY (id);
ALTER TABLE public.fx_usd_brl_history ADD CONSTRAINT fx_usd_brl_history_pkey PRIMARY KEY (id);
ALTER TABLE public.integration_actions ADD CONSTRAINT integration_actions_pkey PRIMARY KEY (id);
ALTER TABLE public.integration_catalog ADD CONSTRAINT integration_catalog_pkey PRIMARY KEY (slug);
ALTER TABLE public.knowledge_domains ADD CONSTRAINT knowledge_domains_pkey PRIMARY KEY (id);
ALTER TABLE public.knowledge_entity_links ADD CONSTRAINT knowledge_entity_links_pkey PRIMARY KEY (id);
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.markup_rules ADD CONSTRAINT markup_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.message_attachments ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.message_feedback ADD CONSTRAINT message_feedback_pkey PRIMARY KEY (id);
ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE public.mp_pix_payments ADD CONSTRAINT mp_pix_payments_pkey PRIMARY KEY (id);
ALTER TABLE public.neurocores ADD CONSTRAINT neurocores_pkey PRIMARY KEY (id);
ALTER TABLE public.niche_channel_defaults ADD CONSTRAINT niche_channel_defaults_pkey PRIMARY KEY (id);
ALTER TABLE public.niches ADD CONSTRAINT niches_pkey PRIMARY KEY (id);
ALTER TABLE public.platform_admins ADD CONSTRAINT platform_admins_pkey PRIMARY KEY (id);
ALTER TABLE public.platform_configs ADD CONSTRAINT platform_configs_pkey PRIMARY KEY (key);
ALTER TABLE public.pricing_component_prices ADD CONSTRAINT pricing_component_prices_pkey PRIMARY KEY (id);
ALTER TABLE public.pricing_components ADD CONSTRAINT pricing_components_pkey PRIMARY KEY (id);
ALTER TABLE public.pricing_skus ADD CONSTRAINT pricing_skus_pkey PRIMARY KEY (id);
ALTER TABLE public.quick_reply_templates ADD CONSTRAINT quick_reply_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.sched_appointment_resource_allocations ADD CONSTRAINT sched_alloc_pkey PRIMARY KEY (id);
ALTER TABLE public.sched_appointment_services ADD CONSTRAINT sched_appt_services_pkey PRIMARY KEY (id);
ALTER TABLE public.sched_appointments ADD CONSTRAINT sched_appointments_pkey PRIMARY KEY (id);
ALTER TABLE public.sched_availability_exceptions ADD CONSTRAINT sched_avail_exc_pkey PRIMARY KEY (id);
ALTER TABLE public.sched_availability_windows ADD CONSTRAINT sched_avail_win_pkey PRIMARY KEY (id);
ALTER TABLE public.sched_resources ADD CONSTRAINT sched_resources_pkey PRIMARY KEY (id);
ALTER TABLE public.sched_service_resource_requirements ADD CONSTRAINT sched_srv_req_pkey PRIMARY KEY (id);
ALTER TABLE public.sched_services ADD CONSTRAINT sched_services_pkey PRIMARY KEY (id);
ALTER TABLE public.sched_settings ADD CONSTRAINT sched_settings_pkey PRIMARY KEY (tenant_id);
ALTER TABLE public.sched_units ADD CONSTRAINT sched_units_pkey PRIMARY KEY (id);
ALTER TABLE public.stripe_checkout_sessions ADD CONSTRAINT stripe_checkout_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);
ALTER TABLE public.tag_triggers ADD CONSTRAINT tag_triggers_pkey PRIMARY KEY (id);
ALTER TABLE public.tags ADD CONSTRAINT tags_pkey PRIMARY KEY (id);
ALTER TABLE public.team_members ADD CONSTRAINT team_members_pkey PRIMARY KEY (team_id, user_id);
ALTER TABLE public.teams ADD CONSTRAINT teams_pkey PRIMARY KEY (id);
ALTER TABLE public.tenant_conversation_timeout_settings ADD CONSTRAINT tenant_conversation_timeout_settings_pkey PRIMARY KEY (tenant_id);
ALTER TABLE public.tenant_integrations ADD CONSTRAINT tenant_integrations_pkey PRIMARY KEY (id);
ALTER TABLE public.tenant_reactivation_rules_steps ADD CONSTRAINT tenant_reactivation_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.tenant_reactivation_rules_steps_tags ADD CONSTRAINT tenant_reactivation_rules_steps_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.tenant_reactivation_settings ADD CONSTRAINT tenant_reactivation_settings_pkey PRIMARY KEY (tenant_id);
ALTER TABLE public.tenants ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);
ALTER TABLE public.ura_configs ADD CONSTRAINT ura_configs_pkey PRIMARY KEY (id);
ALTER TABLE public.ura_rules ADD CONSTRAINT ura_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.usages ADD CONSTRAINT usages_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.wallets ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);
ALTER TABLE onboarding.onboarding_async_jobs ADD CONSTRAINT onboarding_async_jobs_pkey PRIMARY KEY (id);
ALTER TABLE onboarding.onboarding_channel_requests ADD CONSTRAINT onboarding_channel_requests_pkey PRIMARY KEY (id);
ALTER TABLE onboarding.onboarding_templates ADD CONSTRAINT onboarding_templates_pkey PRIMARY KEY (id);
ALTER TABLE onboarding.tenant_onboarding_sessions ADD CONSTRAINT tenant_onboarding_sessions_pkey PRIMARY KEY (id);

ALTER TABLE public.agent_prompts ADD CONSTRAINT agent_prompts_agent_tenant_unique UNIQUE (id_agent, id_tenant);
ALTER TABLE public.agent_schedule_weekly ADD CONSTRAINT agent_schedule_weekly_unique_slot UNIQUE (tenant_id, day_of_week, start_time);
ALTER TABLE public.auto_recharge_configs ADD CONSTRAINT auto_recharge_configs_tenant_id_key UNIQUE (tenant_id);
ALTER TABLE public.base_conhecimento_google_store ADD CONSTRAINT base_conhecimento_google_store_display_name_key UNIQUE (display_name);
ALTER TABLE public.channel_providers ADD CONSTRAINT channel_providers_name_key UNIQUE (name);
ALTER TABLE public.channel_types ADD CONSTRAINT channel_types_name_key UNIQUE (name);
ALTER TABLE public.conversation_tags ADD CONSTRAINT conversation_tags_unique UNIQUE (conversation_id, tag_id);
ALTER TABLE public.credit_packages ADD CONSTRAINT credit_packages_stripe_price_id_key UNIQUE (stripe_price_id);
ALTER TABLE public.feature_modules ADD CONSTRAINT feature_modules_key_key UNIQUE (key);
ALTER TABLE public.integration_actions ADD CONSTRAINT integration_actions_unique_slug UNIQUE (integration_slug, slug);
ALTER TABLE public.knowledge_entity_links ADD CONSTRAINT knowledge_entity_links_unique UNIQUE (entity_type, entity_id, base_conhecimento_id);
ALTER TABLE public.message_attachments ADD CONSTRAINT message_attachments_storage_unique UNIQUE (storage_bucket, storage_path);
ALTER TABLE public.message_feedback ADD CONSTRAINT message_feedback_message_id_user_id_key UNIQUE (message_id, user_id);
ALTER TABLE public.mp_pix_payments ADD CONSTRAINT mp_pix_payments_mp_payment_id_key UNIQUE (mp_payment_id);
ALTER TABLE public.niche_channel_defaults ADD CONSTRAINT niche_channel_defaults_niche_id_channel_type_id_key UNIQUE (niche_id, channel_type_id);
ALTER TABLE public.niches ADD CONSTRAINT niches_name_key UNIQUE (name);
ALTER TABLE public.platform_admins ADD CONSTRAINT platform_admins_email_key UNIQUE (email);
ALTER TABLE public.pricing_components ADD CONSTRAINT pricing_components_sku_id_measure_key_key UNIQUE (sku_id, measure_key);
ALTER TABLE public.pricing_skus ADD CONSTRAINT pricing_skus_provider_sku_key UNIQUE (provider, sku);
ALTER TABLE public.stripe_checkout_sessions ADD CONSTRAINT stripe_checkout_sessions_stripe_session_id_key UNIQUE (stripe_session_id);
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_stripe_price_id_key UNIQUE (stripe_price_id);
ALTER TABLE public.tenant_reactivation_rules_steps_tags ADD CONSTRAINT tenant_reactivation_rules_steps_tags_unique UNIQUE (reactivation_rule_step_id, tag_id);
ALTER TABLE public.tenants ADD CONSTRAINT tenants_cnpj_key UNIQUE (cnpj);
ALTER TABLE public.tenants ADD CONSTRAINT tenants_stripe_customer_id_key UNIQUE (stripe_customer_id);
ALTER TABLE public.tenants ADD CONSTRAINT tenants_stripe_subscription_id_key UNIQUE (stripe_subscription_id);
ALTER TABLE public.ura_configs ADD CONSTRAINT ura_configs_tenant_id_key UNIQUE (tenant_id);
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE public.users ADD CONSTRAINT users_invite_code_key UNIQUE (invite_code);
ALTER TABLE public.wallets ADD CONSTRAINT wallets_tenant_id_key UNIQUE (tenant_id);
ALTER TABLE onboarding.onboarding_channel_requests ADD CONSTRAINT onboarding_channel_requests_session_unique UNIQUE (session_id);


-- 5. FUNCTIONS — onboarding schema (needed before migrations run)
-- ============================================================
CREATE OR REPLACE FUNCTION onboarding.activate_session(p_session_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_session          onboarding.tenant_onboarding_sessions%ROWTYPE;
  v_template         onboarding.onboarding_templates%ROWTYPE;
  v_payload          jsonb;
  v_tenant_id        uuid;
  v_agent_id         uuid;
  v_tag              jsonb;
  v_step             jsonb;
  v_step_id          uuid;
  v_tag_name         text;
  v_tag_id           uuid;
  v_channel          record;
  v_niche_id         uuid;
  v_neurocore_id     uuid;
  v_provider_id      uuid;
BEGIN
  -- 1. Travar sessão (garante idempotência)
  SELECT * INTO v_session
  FROM onboarding.tenant_onboarding_sessions
  WHERE id = p_session_id
    AND created_by = p_user_id
    AND status = 'ready_to_activate'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão % não está pronta para ativação (status deve ser ready_to_activate)', p_session_id;
  END IF;

  SELECT * INTO v_template
  FROM onboarding.onboarding_templates
  WHERE id = v_session.template_id;

  v_payload := v_session.payload;

  -- Marcar como ativando
  UPDATE onboarding.tenant_onboarding_sessions
  SET status = 'activating', updated_at = now()
  WHERE id = p_session_id;

  -- 2. Resolver niche_id — FK direta, com fallback para text match (compatibilidade)
  v_niche_id := COALESCE(
    v_template.niche_id,
    (SELECT id FROM public.niches WHERE LOWER(name) = LOWER(v_template.niche) LIMIT 1)
  );

  -- 3. Resolver neurocore_id e channel_provider_id de niche_channel_defaults
  SELECT ncd.neurocore_id, ncd.channel_provider_id
  INTO   v_neurocore_id, v_provider_id
  FROM   public.niche_channel_defaults ncd
  JOIN   public.channel_types ct ON ct.id = ncd.channel_type_id
  WHERE  ncd.niche_id   = v_niche_id
    AND  ct.name        = 'whatsapp'
    AND  ncd.is_active  = true
  LIMIT 1;

  v_neurocore_id := COALESCE(v_neurocore_id, v_template.default_neurocore_id);
  v_provider_id  := COALESCE(
    v_provider_id,
    (v_payload -> 'channel' ->> 'provider_id')::uuid
  );

  -- 4. Criar tenant
  INSERT INTO public.tenants (
    name, neurocore_id, cnpj, phone,
    responsible_tech_name, responsible_tech_whatsapp, responsible_tech_email,
    responsible_finance_name, responsible_finance_whatsapp, responsible_finance_email,
    plan, niche_id, subscription_status, is_active
  ) VALUES (
    v_payload -> 'company' ->> 'trade_name',
    v_neurocore_id,
    COALESCE(v_payload -> 'company' ->> 'cnpj', ''),
    COALESCE(v_payload -> 'company' ->> 'phone', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'technical' ->> 'name', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'technical' ->> 'whatsapp', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'technical' ->> 'email', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'financial' ->> 'name', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'financial' ->> 'whatsapp', ''),
    COALESCE(v_payload -> 'company' -> 'responsibles' -> 'financial' ->> 'email', ''),
    COALESCE(v_payload -> 'company' ->> 'plan', 'trial'),
    v_niche_id, 'trialing', true
  )
  RETURNING id INTO v_tenant_id;

  -- 5. Criar wallet
  INSERT INTO public.wallets (tenant_id, balance_credits)
  VALUES (v_tenant_id, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- 6. Criar agent
  INSERT INTO public.agents (name, type, reactive, id_neurocore)
  VALUES (
    COALESCE(v_payload -> 'agent' ->> 'name', 'Lívia'),
    COALESCE(v_payload -> 'agent' ->> 'type', 'attendant')::agent_type_enum,
    COALESCE((v_payload -> 'agent' ->> 'reactive')::boolean, true),
    v_neurocore_id
  )
  RETURNING id INTO v_agent_id;

  -- 7. Criar agent_prompts (persona)
  INSERT INTO public.agent_prompts (
    name, age, gender, objective, comunication, personality, id_agent, id_tenant
  ) VALUES (
    COALESCE(v_payload -> 'agent' ->> 'name', 'Lívia'),
    COALESCE(v_payload -> 'agent' -> 'persona' ->> 'age', ''),
    COALESCE(v_payload -> 'agent' -> 'persona' ->> 'gender', 'female')::agent_gender_enum,
    COALESCE(v_payload -> 'agent' -> 'profile' ->> 'objective', ''),
    COALESCE(v_payload -> 'agent' -> 'profile' ->> 'communication', ''),
    COALESCE(v_payload -> 'agent' -> 'profile' ->> 'personality', ''),
    v_agent_id, v_tenant_id
  );

  -- 8. Criar agent_prompts_guard_rails
  INSERT INTO public.agent_prompts_guard_rails (
    prompt_jailbreak, prompt_nsfw, id_agent, id_tenant
  ) VALUES (
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'guardrails' ->> 'prompt_jailbreak', ''),
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'guardrails' ->> 'prompt_nsfw', ''),
    v_agent_id, v_tenant_id
  );

  -- 9. Criar agent_prompts_intention
  INSERT INTO public.agent_prompts_intention (prompt, id_agent, id_tenant)
  VALUES (
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'intentions' ->> 'prompt', ''),
    v_agent_id, v_tenant_id
  );

  -- 10. Criar agent_prompts_internal_system
  INSERT INTO public.agent_prompts_internal_system (prompt, id_agent, id_tenant)
  VALUES (
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'internal_system' ->> 'prompt', ''),
    v_agent_id, v_tenant_id
  );

  -- 11. Criar agent_prompts_observer
  INSERT INTO public.agent_prompts_observer (prompt, id_agent, id_tenant)
  VALUES (
    COALESCE(v_payload -> 'ai_operation' -> 'prompts' -> 'observer' ->> 'prompt', ''),
    v_agent_id, v_tenant_id
  );

  -- 12. Criar tags
  IF v_payload ? 'tags' AND v_payload -> 'tags' ? 'items' THEN
    FOR v_tag IN SELECT * FROM jsonb_array_elements(v_payload -> 'tags' -> 'items')
    LOOP
      INSERT INTO public.tags (
        tag_name, color, order_index, active, pause_ia_on_apply, tenant_id, id_neurocore
      ) VALUES (
        v_tag ->> 'tag_name',
        COALESCE(v_tag ->> 'color', '#3b82f6'),
        COALESCE((v_tag ->> 'order_index')::integer, 0),
        COALESCE((v_tag ->> 'active')::boolean, true),
        COALESCE((v_tag ->> 'pause_ia_on_apply')::boolean, false),
        v_tenant_id, v_neurocore_id
      );
    END LOOP;
  END IF;

  -- 13. Criar timeout settings
  INSERT INTO public.tenant_conversation_timeout_settings (
    tenant_id, ia_inactive_timeout_minutes, closure_message, is_active
  ) VALUES (
    v_tenant_id,
    COALESCE((v_payload -> 'conversation_rules' -> 'timeouts' ->> 'ia_inactive_timeout_minutes')::integer, 30),
    COALESCE(v_payload -> 'conversation_rules' -> 'timeouts' ->> 'closure_message', 'Conversa encerrada por inatividade.'),
    COALESCE((v_payload -> 'conversation_rules' -> 'timeouts' ->> 'is_active')::boolean, true)
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    ia_inactive_timeout_minutes = EXCLUDED.ia_inactive_timeout_minutes,
    closure_message             = EXCLUDED.closure_message,
    is_active                   = EXCLUDED.is_active,
    updated_at                  = now();

  -- 14. Criar reactivation settings
  INSERT INTO public.tenant_reactivation_settings (
    tenant_id, exhausted_action, exhausted_message,
    max_reactivation_window_minutes, max_window_action, max_window_message
  ) VALUES (
    v_tenant_id,
    COALESCE(v_payload -> 'conversation_rules' -> 'reactivation' ->> 'exhausted_action', 'end_conversation')::tenant_reactivation_fallback_action,
    COALESCE(v_payload -> 'conversation_rules' -> 'reactivation' ->> 'exhausted_message', 'Conversa encerrada devido inatividade.'),
    COALESCE((v_payload -> 'conversation_rules' -> 'reactivation' ->> 'max_reactivation_window_minutes')::integer, 1440),
    COALESCE(v_payload -> 'conversation_rules' -> 'reactivation' ->> 'max_window_action', 'end_conversation')::tenant_reactivation_fallback_action,
    COALESCE(v_payload -> 'conversation_rules' -> 'reactivation' ->> 'max_window_message', 'Janela máxima atingida.')
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    exhausted_action                = EXCLUDED.exhausted_action,
    exhausted_message               = EXCLUDED.exhausted_message,
    max_reactivation_window_minutes = EXCLUDED.max_reactivation_window_minutes,
    max_window_action               = EXCLUDED.max_window_action,
    max_window_message              = EXCLUDED.max_window_message,
    updated_at                      = now();

  -- 15. Criar reactivation steps
  IF v_payload ? 'conversation_rules' AND v_payload -> 'conversation_rules' ? 'reactivation_steps' THEN
    FOR v_step IN
      SELECT * FROM jsonb_array_elements(v_payload -> 'conversation_rules' -> 'reactivation_steps')
    LOOP
      INSERT INTO public.tenant_reactivation_rules_steps (
        tenant_id, sequence, wait_time_minutes, action_type,
        action_parameter, start_time, end_time
      ) VALUES (
        v_tenant_id,
        COALESCE((v_step ->> 'sequence')::integer, 1),
        COALESCE((v_step ->> 'wait_time_minutes')::integer, 15),
        COALESCE(v_step ->> 'action_type', 'send_message')::reactivation_action_type,
        v_step ->> 'action_parameter',
        (v_step ->> 'start_time')::time,
        (v_step ->> 'end_time')::time
      )
      RETURNING id INTO v_step_id;

      IF v_step ? 'tags_to_apply' THEN
        FOR v_tag_name IN
          SELECT jsonb_array_elements_text(v_step -> 'tags_to_apply')
        LOOP
          SELECT id INTO v_tag_id
          FROM public.tags
          WHERE tenant_id = v_tenant_id
            AND LOWER(tag_name) = LOWER(v_tag_name)
          LIMIT 1;

          IF v_tag_id IS NOT NULL THEN
            INSERT INTO public.tenant_reactivation_rules_steps_tags
              (reactivation_rule_step_id, tag_id)
            VALUES (v_step_id, v_tag_id)
            ON CONFLICT DO NOTHING;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 16. Criar base_conhecimentos
  IF v_payload ? 'knowledge' THEN
    INSERT INTO public.base_conhecimentos (
      tenant_id, name, description, neurocore_id, is_active
    ) VALUES (
      v_tenant_id,
      COALESCE(v_payload -> 'knowledge' ->> 'name', 'Base de Conhecimento'),
      v_payload -> 'knowledge' ->> 'description',
      v_neurocore_id,
      false
    );
  END IF;

  -- 17. Criar channel (corrigido: usa config_json, sem colunas dropadas)
  IF (v_payload -> 'channel' ->> 'connection_status') = 'connected'
    AND v_provider_id IS NOT NULL
  THEN
    INSERT INTO public.channels (
      tenant_id,
      channel_provider_id,
      name,
      identification_number,
      connection_status,
      config_json,
      is_active,
      is_receiving_messages,
      is_sending_messages
    ) VALUES (
      v_tenant_id,
      v_provider_id,
      COALESCE(v_payload -> 'channel' ->> 'desired_number', 'Canal WhatsApp'),
      COALESCE(v_payload -> 'channel' ->> 'desired_number', ''),
      'connected',
      jsonb_build_object(
        'instance_name',     v_payload -> 'channel' ->> 'instance_name',
        'instance_id_api',   v_payload -> 'channel' ->> 'instance_id_api',
        'webhook_url',       v_payload -> 'channel' ->> 'webhook_url',
        'evolution_api_url', v_payload -> 'channel' ->> 'evolution_api_url',
        'settings',          COALESCE(v_payload -> 'channel' -> 'settings', '{}'::jsonb)
      ),
      true,
      true,
      true
    );
  END IF;

  -- 18. Atualizar usuário criador com o novo tenant
  UPDATE public.users
  SET tenant_id = v_tenant_id, updated_at = now()
  WHERE id = p_user_id;

  -- 19. Criar async jobs para n8n
  INSERT INTO onboarding.onboarding_async_jobs
    (session_id, job_type, payload)
  VALUES
    (
      p_session_id, 'kb_vectorize',
      jsonb_build_object(
        'tenant_id',  v_tenant_id,
        'session_id', p_session_id,
        'knowledge',  v_payload -> 'knowledge',
        'faq',        v_payload -> 'faq',
        'catalog',    v_payload -> 'catalog'
      )
    ),
    (
      p_session_id, 'post_activation',
      jsonb_build_object(
        'tenant_id',  v_tenant_id,
        'session_id', p_session_id,
        'agent_id',   v_agent_id
      )
    );

  -- 20. Finalizar sessão
  UPDATE onboarding.tenant_onboarding_sessions
  SET
    status       = 'active',
    tenant_id    = v_tenant_id,
    activated_at = now(),
    updated_at   = now()
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success',    true,
    'tenant_id',  v_tenant_id,
    'agent_id',   v_agent_id,
    'session_id', p_session_id
  );

EXCEPTION WHEN OTHERS THEN
  UPDATE onboarding.tenant_onboarding_sessions
  SET
    status        = 'failed',
    error_message = SQLERRM,
    updated_at    = now()
  WHERE id = p_session_id;

  RAISE;
END;
$function$
;

CREATE OR REPLACE FUNCTION onboarding.channel_upsert_state(p_session_id uuid, p_status text, p_qr_code text DEFAULT NULL::text, p_phone_number text DEFAULT NULL::text, p_whatsapp_id text DEFAULT NULL::text, p_n8n_job_id text DEFAULT NULL::text, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO onboarding.onboarding_channel_requests
    (session_id, status, qr_code, phone_number, whatsapp_id, n8n_job_id, error_message, connected_at)
  VALUES (
    p_session_id,
    p_status,
    p_qr_code,
    p_phone_number,
    p_whatsapp_id,
    p_n8n_job_id,
    p_error,
    CASE WHEN p_status = 'connected' THEN now() ELSE NULL END
  )
  ON CONFLICT (session_id) DO UPDATE SET
    status        = EXCLUDED.status,
    qr_code       = COALESCE(EXCLUDED.qr_code,       onboarding_channel_requests.qr_code),
    phone_number  = COALESCE(EXCLUDED.phone_number,  onboarding_channel_requests.phone_number),
    whatsapp_id   = COALESCE(EXCLUDED.whatsapp_id,   onboarding_channel_requests.whatsapp_id),
    n8n_job_id    = COALESCE(EXCLUDED.n8n_job_id,    onboarding_channel_requests.n8n_job_id),
    error_message = EXCLUDED.error_message,
    connected_at  = CASE
                      WHEN EXCLUDED.status = 'connected' THEN now()
                      ELSE onboarding_channel_requests.connected_at
                    END,
    updated_at    = now();

  -- Se conectado: atualizar payload da sessão e avançar status
  IF p_status = 'connected' THEN
    UPDATE onboarding.tenant_onboarding_sessions
    SET
      payload = jsonb_set(
        jsonb_set(
          jsonb_set(
            payload,
            '{channel,connection_status}', '"connected"'::jsonb, true
          ),
          '{channel,desired_number}', to_jsonb(p_phone_number), true
        ),
        '{channel,external_channel_id}', to_jsonb(p_whatsapp_id), true
      ),
      status     = CASE WHEN status = 'awaiting_channel' THEN 'ready_to_activate' ELSE status END,
      updated_at = now()
    WHERE id = p_session_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION onboarding.create_session(p_template_id uuid, p_created_by uuid)
 RETURNS onboarding.tenant_onboarding_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_template onboarding.onboarding_templates%ROWTYPE;
  v_session  onboarding.tenant_onboarding_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_template
  FROM onboarding.onboarding_templates
  WHERE id = p_template_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template % não encontrado ou inativo', p_template_id;
  END IF;

  INSERT INTO onboarding.tenant_onboarding_sessions
    (template_id, created_by, status, payload)
  VALUES
    (p_template_id, p_created_by, 'draft', v_template.default_payload)
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$function$
;

CREATE OR REPLACE FUNCTION onboarding.kb_vectorize_result(p_session_id uuid, p_base_id uuid, p_vectors_created integer DEFAULT 0, p_success boolean DEFAULT true, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Ativar base de conhecimento se vetorização teve sucesso
  IF p_success AND p_base_id IS NOT NULL THEN
    UPDATE public.base_conhecimentos
    SET is_active = true, updated_at = now()
    WHERE id = p_base_id;
  END IF;

  -- Marcar job
  UPDATE onboarding.onboarding_async_jobs
  SET
    status        = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    result        = jsonb_build_object(
                      'vectors_created', p_vectors_created,
                      'base_id',         p_base_id
                    ),
    error_message = p_error,
    completed_at  = CASE WHEN p_success THEN now() ELSE NULL END,
    updated_at    = now()
  WHERE session_id = p_session_id AND job_type = 'kb_vectorize';
END;
$function$
;

CREATE OR REPLACE FUNCTION onboarding.post_activation_result(p_session_id uuid, p_success boolean DEFAULT true, p_result jsonb DEFAULT NULL::jsonb, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE onboarding.onboarding_async_jobs
  SET
    status        = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    result        = p_result,
    error_message = p_error,
    completed_at  = CASE WHEN p_success THEN now() ELSE NULL END,
    updated_at    = now()
  WHERE session_id = p_session_id AND job_type = 'post_activation';
END;
$function$
;

CREATE OR REPLACE FUNCTION onboarding.save_step(p_session_id uuid, p_step_key text, p_step_payload jsonb, p_user_id uuid)
 RETURNS onboarding.tenant_onboarding_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_session onboarding.tenant_onboarding_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM onboarding.tenant_onboarding_sessions
  WHERE id = p_session_id
    AND created_by = p_user_id
    AND status NOT IN ('activating', 'active', 'failed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão % não encontrada, não pertence ao usuário ou não é editável', p_session_id;
  END IF;

  UPDATE onboarding.tenant_onboarding_sessions
  SET
    payload         = jsonb_set(payload, ARRAY[p_step_key], p_step_payload, true),
    current_step    = p_step_key,
    completed_steps = array_append(
                        array_remove(completed_steps, p_step_key),
                        p_step_key
                      ),
    status          = CASE WHEN status = 'draft' THEN 'in_progress' ELSE status END,
    updated_at      = now()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$function$
;

CREATE OR REPLACE FUNCTION onboarding.validate_session(p_session_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_session        onboarding.tenant_onboarding_sessions%ROWTYPE;
  v_template       onboarding.onboarding_templates%ROWTYPE;
  v_missing        text[] := '{}';
  v_required_step  text;
  v_channel_status text;
  v_require_channel boolean;
BEGIN
  SELECT * INTO v_session
  FROM onboarding.tenant_onboarding_sessions
  WHERE id = p_session_id AND created_by = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão % não encontrada ou não pertence ao usuário', p_session_id;
  END IF;

  SELECT * INTO v_template
  FROM onboarding.onboarding_templates
  WHERE id = v_session.template_id;

  -- Verificar required_steps do template
  IF v_template.activation_rules ? 'required_steps' THEN
    FOR v_required_step IN
      SELECT jsonb_array_elements_text(v_template.activation_rules -> 'required_steps')
    LOOP
      IF NOT (v_session.payload ? v_required_step)
        OR (v_session.payload -> v_required_step = 'null'::jsonb)
        OR (v_session.payload -> v_required_step = '{}'::jsonb)
        OR (v_session.payload -> v_required_step = '[]'::jsonb)
      THEN
        v_missing := array_append(v_missing, v_required_step);
      END IF;
    END LOOP;
  END IF;

  -- Verificar canal se exigido pelo template
  v_require_channel := COALESCE(
    (v_template.activation_rules ->> 'require_channel')::boolean,
    false
  );

  IF v_require_channel THEN
    SELECT status INTO v_channel_status
    FROM onboarding.onboarding_channel_requests
    WHERE session_id = p_session_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_channel_status IS DISTINCT FROM 'connected' THEN
      v_missing := array_append(v_missing, 'channel_not_connected');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ready',   cardinality(v_missing) = 0,
    'missing', to_jsonb(v_missing),
    'stats', jsonb_build_object(
      'completed_steps',  array_length(v_session.completed_steps, 1),
      'total_steps',      jsonb_array_length(v_template.wizard_schema),
      'status',           v_session.status,
      'current_step',     v_session.current_step
    )
  );
END;
$function$
;

-- 4. ROW LEVEL SECURITY (enable only)
-- ============================================================
ALTER TABLE public.agent_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_prompts_guard_rails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_prompts_intention ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_prompts_internal_system ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_prompts_observer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_schedule_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_schedule_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_recharge_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_conhecimento_google_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_conhecimento_google_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_conhecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_data_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reasons_pauses_and_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_pix_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_appointment_resource_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_availability_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_service_resource_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sched_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_conversation_timeout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ura_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ura_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
