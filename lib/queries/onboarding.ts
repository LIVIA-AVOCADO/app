/**
 * Queries para o módulo de Onboarding
 *
 * Tabelas do schema `onboarding` não têm tipos gerados —
 * usamos (supabase as any) com eslint-disable conforme padrão do projeto.
 */

import { createClient } from '@/lib/supabase/server';
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
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('onboarding')
    .from('onboarding_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching onboarding templates:', error);
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
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('onboarding')
    .from('onboarding_templates')
    .select('*')
    .eq('id', templateId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching template:', error);
    return null;
  }

  return data as OnboardingTemplate | null;
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
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('onboarding')
    .from('tenant_onboarding_sessions')
    .select(`
      *,
      template:onboarding_templates(*)
    `)
    .eq('id', sessionId)
    .eq('created_by', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching onboarding session:', error);
    return null;
  }

  return data as OnboardingSessionWithTemplate | null;
}

/**
 * Busca a sessão mais recente em andamento do usuário
 * (para retomar onde parou)
 */
export async function getUserLatestSession(
  userId: string
): Promise<OnboardingSession | null> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('onboarding')
    .from('tenant_onboarding_sessions')
    .select('*')
    .eq('created_by', userId)
    .not('status', 'in', '("active","failed")')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching latest onboarding session:', error);
    return null;
  }

  return data as OnboardingSession | null;
}
