/**
 * Types para o sistema de Reativacao de Conversas
 *
 * As tabelas (tenant_reactivation_settings, tenant_reactivation_rules_steps,
 * tenant_reactivation_rules_steps_tags) existem no Supabase mas nao estao
 * nos tipos gerados. Usamos tipos manuais + (supabase as any).
 */

// ===== ENUMS =====

/** Tipos de acao que um step de reativacao pode executar (DB enum: reactivation_action_type) */
export type ReactivationActionType =
  | 'send_message'
  | 'send_audio'
  | 'close_conversation'
  | 'transfer_to_human';

/** Tipos de acao expostos na UI (sem send_audio - nao suportado ainda) */
export type ReactivationActionTypeUI = Exclude<ReactivationActionType, 'send_audio'>;

/** Acao de fallback quando etapas se esgotam ou janela maxima e atingida */
export type ReactivationFallbackAction =
  | 'end_conversation'
  | 'transfer_to_human'
  | 'do_nothing';

// ===== ENTITIES (DB rows) =====

export interface ReactivationSettings {
  tenant_id: string;
  exhausted_action: ReactivationFallbackAction;
  exhausted_message: string | null;
  max_reactivation_window_minutes: number | null;
  max_window_action: ReactivationFallbackAction;
  max_window_message: string | null;
  reactivate_when_ia_active_false: boolean;
  reactivate_only_after_first_human_message: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReactivationStep {
  id: string;
  tenant_id: string;
  sequence: number;
  wait_time_minutes: number;
  action_type: ReactivationActionType;
  action_parameter: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReactivationStepTag {
  id: string;
  step_id: string;
  tag_id: string;
  created_at: string;
}

/** Step com tags populadas (join) */
export interface ReactivationStepWithTags extends ReactivationStep {
  tags: {
    id: string;
    tag_name: string;
    tag_type: string;
    color: string | null;
  }[];
}

// ===== FORM TYPES =====

export interface ReactivationSettingsFormData {
  exhausted_action: ReactivationFallbackAction;
  exhausted_message: string;
  max_reactivation_window_minutes: number | null;
  max_window_action: ReactivationFallbackAction;
  max_window_message: string;
  reactivate_when_ia_active_false: boolean;
  reactivate_only_after_first_human_message: boolean;
}

export interface ReactivationStepFormData {
  wait_time_minutes: number;
  action_type: ReactivationActionTypeUI;
  action_parameter: string;
  start_time: string;
  end_time: string;
  tag_ids: string[];
}

export interface ReactivationFormData {
  settings: ReactivationSettingsFormData;
  steps: ReactivationStepFormData[];
}

// ===== PROPS =====

export interface ReactivationPageData {
  settings: ReactivationSettings | null;
  steps: ReactivationStepWithTags[];
  availableTags: {
    id: string;
    tag_name: string;
    tag_type: string;
    color: string | null;
  }[];
}
