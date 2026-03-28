// ============================================================
// Types: Módulo de Onboarding
// ============================================================

export type SessionStatus =
  | 'draft'
  | 'in_progress'
  | 'awaiting_channel'
  | 'ready_to_activate'
  | 'activating'
  | 'active'
  | 'failed';

export type ChannelStatus = 'pending' | 'qr_ready' | 'connected' | 'failed';

// ------------------------------------------------------------
// Wizard Schema (vem do template.wizard_schema no banco)
// ------------------------------------------------------------
export interface WizardStepConfig {
  key: string;
  title: string;
  description?: string;
  icon?: string;
  required?: boolean;
}

// ------------------------------------------------------------
// Template
// ------------------------------------------------------------
export interface OnboardingTemplate {
  id: string;
  name: string;
  niche: string;
  description: string | null;
  default_neurocore_id: string;
  wizard_schema: WizardStepConfig[];
  default_payload: OnboardingPayload;
  activation_rules: {
    required_steps?: string[];
    require_channel?: boolean;
  };
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// Session
// ------------------------------------------------------------
export interface OnboardingSession {
  id: string;
  template_id: string;
  created_by: string;
  tenant_id: string | null;
  status: SessionStatus;
  payload: OnboardingPayload;
  current_step: string | null;
  completed_steps: string[];
  error_message: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingSessionWithTemplate extends OnboardingSession {
  template: OnboardingTemplate;
}

// ------------------------------------------------------------
// Payload blocks
// ------------------------------------------------------------
export interface CompanyPayload {
  trade_name?: string;
  cnpj?: string;
  phone?: string;
  employee_count?: string;
  website?: string;
  has_no_website?: boolean;
  niche?: string;
  responsibles?: {
    technical?: { name?: string; whatsapp?: string; email?: string };
    financial?: { name?: string; whatsapp?: string; email?: string };
  };
  plan?: string;
}

export interface BusinessProfilePayload {
  description?: string;
  service_regions?: string[];
}

export interface CatalogItem {
  type?: string;
  code?: string;
  name: string;
  price?: number;
  delivery_time?: string;
  custom_fields?: Record<string, unknown>;
}

export interface CatalogPayload {
  items?: CatalogItem[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqPayload {
  items?: FaqItem[];
}

export interface ServicePayload {
  tone?: string;
  style?: string;
  forbidden_topics?: string[];
}

export interface ScriptStep {
  order: number;
  name: string;
  instruction: string;
}

export interface ScriptPayload {
  steps?: ScriptStep[];
}

export interface ChannelPayload {
  provider_id?: string;
  desired_number?: string;
  connection_status?: string;
  external_channel_id?: string;
}

export interface KnowledgePayload {
  name?: string;
  description?: string;
  extra_information?: string[];
}

export interface AgentPayload {
  name?: string;
  type?: string;
  reactive?: boolean;
  persona?: { gender?: string; age?: string };
  profile?: {
    objective?: string;
    communication?: string;
    personality?: string;
  };
}

export interface AiOperationPayload {
  prompts?: {
    guardrails?: { prompt_jailbreak?: string; prompt_nsfw?: string };
    intentions?: { prompt?: string };
    internal_system?: { prompt?: string };
    observer?: { prompt?: string };
  };
}

export interface ReactivationStepPayload {
  sequence: number;
  wait_time_minutes: number;
  action_type: string;
  action_parameter?: string;
  start_time?: string;
  end_time?: string;
  tags_to_apply?: string[];
}

export interface ConversationRulesPayload {
  timeouts?: {
    ia_inactive_timeout_minutes?: number;
    closure_message?: string;
    is_active?: boolean;
  };
  reactivation?: {
    exhausted_action?: string;
    exhausted_message?: string;
    max_reactivation_window_minutes?: number;
    max_window_action?: string;
    max_window_message?: string;
  };
  reactivation_steps?: ReactivationStepPayload[];
}

export interface TagPayloadItem {
  tag_name: string;
  color: string;
  order_index?: number;
  active?: boolean;
  pause_ia_on_apply?: boolean;
}

export interface TagsPayload {
  items?: TagPayloadItem[];
}

export interface ActivationPayload {
  reviewed?: boolean;
  provision?: {
    create_agent?: boolean;
    create_tags?: boolean;
    create_knowledge_bases?: boolean;
    create_timeout_rules?: boolean;
    create_reactivation_rules?: boolean;
    request_vectorization?: boolean;
    request_post_activation?: boolean;
  };
}

export interface OnboardingPayload {
  company?: CompanyPayload;
  business_profile?: BusinessProfilePayload;
  catalog?: CatalogPayload;
  faq?: FaqPayload;
  service?: ServicePayload;
  script?: ScriptPayload;
  channel?: ChannelPayload;
  knowledge?: KnowledgePayload;
  agent?: AgentPayload;
  ai_operation?: AiOperationPayload;
  conversation_rules?: ConversationRulesPayload;
  tags?: TagsPayload;
  activation?: ActivationPayload;
}

// ------------------------------------------------------------
// Validation result (retorno do RPC validate_session)
// ------------------------------------------------------------
export interface ValidationResult {
  ready: boolean;
  missing: string[];
  stats: {
    completed_steps: number;
    total_steps: number;
    status: SessionStatus;
    current_step: string | null;
  };
}

// ------------------------------------------------------------
// Props padrão para todos os step components
// ------------------------------------------------------------
export interface StepProps {
  payload: OnboardingPayload;
  onChange: (stepKey: string, data: unknown) => void;
  disabled?: boolean;
}
