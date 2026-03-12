/**
 * Queries para o módulo de Onboarding
 *
 * Usa adminClient + RPCs wrapper no schema public para acessar
 * tabelas do schema `onboarding` (não exposto no PostgREST).
 * Segurança garantida por SECURITY DEFINER + validação de ownership.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  OnboardingTemplate,
  OnboardingSession,
  OnboardingSessionWithTemplate,
} from '@/types/onboarding';

// ------------------------------------------------------------
// Templates
// ------------------------------------------------------------

/**
 * Lista todos os templates ativos agrupados por nicho
 */
export async function getActiveTemplates(): Promise<
  Record<string, OnboardingTemplate[]>
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient().rpc as any)(
    'onboarding_get_active_templates',
    {}
  );

  if (error) {
    console.error('[onboarding] Error fetching templates:', JSON.stringify(error));
    return {};
  }

  const templates = (data ?? []) as OnboardingTemplate[];

  return templates.reduce<Record<string, OnboardingTemplate[]>>(
    (acc, template) => {
      const niche = template.niche;
      if (!acc[niche]) acc[niche] = [];
      acc[niche].push(template);
      return acc;
    },
    {}
  );
}

/**
 * Busca um template pelo ID
 */
export async function getTemplateById(
  templateId: string
): Promise<OnboardingTemplate | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient().rpc as any)(
    'onboarding_get_template',
    { p_template_id: templateId }
  );

  if (error) {
    console.error('[onboarding] Error fetching template:', JSON.stringify(error));
    return null;
  }

  const rows = data as OnboardingTemplate[] | null;
  return rows?.[0] ?? null;
}

// ------------------------------------------------------------
// Sessions
// ------------------------------------------------------------

/**
 * Busca uma sessão pelo ID validando ownership
 */
export async function getSession(
  sessionId: string,
  userId: string
): Promise<OnboardingSessionWithTemplate | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient().rpc as any)(
    'onboarding_get_session',
    { p_session_id: sessionId, p_user_id: userId }
  );

  if (error) {
    console.error('[onboarding] Error fetching session:', JSON.stringify(error));
    return null;
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return null;

  const row = rows[0] as Record<string, unknown>;
  // Remonta o objeto com template aninhado (campos prefixados t_ pelo RPC)
  return {
    id:              row.id,
    template_id:     row.template_id,
    created_by:      row.created_by,
    tenant_id:       row.tenant_id,
    status:          row.status,
    payload:         row.payload,
    current_step:    row.current_step,
    completed_steps: row.completed_steps,
    error_message:   row.error_message,
    activated_at:    row.activated_at,
    updated_at:      row.updated_at,
    created_at:      row.created_at,
    template: {
      id:                   row.t_id,
      name:                 row.t_name,
      niche:                row.t_niche,
      description:          row.t_description,
      default_neurocore_id: row.t_default_neurocore_id,
      wizard_schema:        row.t_wizard_schema,
      default_payload:      row.t_default_payload,
      activation_rules:     row.t_activation_rules,
      is_active:            row.t_is_active,
      sort_order:           row.t_sort_order,
      created_at:           row.t_created_at,
      updated_at:           row.t_updated_at,
    },
  } as unknown as OnboardingSessionWithTemplate;
}

/**
 * Busca a sessão mais recente em andamento do usuário
 * (para retomar onde parou)
 */
export async function getUserLatestSession(
  userId: string
): Promise<OnboardingSession | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient().rpc as any)(
    'onboarding_get_latest_session',
    { p_user_id: userId }
  );

  if (error) {
    console.error('[onboarding] Error fetching latest session:', JSON.stringify(error));
    return null;
  }

  const rows = data as OnboardingSession[] | null;
  return rows?.[0] ?? null;
}
