// Queries Supabase para Agent Templates
// Feature: Meus Agentes IA (Plataforma Tenant)

import { createClient } from '@/lib/supabase/server';
import type { AgentWithPrompt } from '@/types/agents';

/**
 * Busca todos os agents do tenant com seus prompts personalizados
 * IMPORTANTE: Usa LEFT JOIN para mostrar agents mesmo sem prompts personalizados
 */
export async function getAgentsByTenant(tenantId: string) {
  const supabase = await createClient();

  // Buscar neurocore_id do tenant para filtro explícito (defense-in-depth:
  // garante isolamento mesmo para super_admins que bypassam RLS)
  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('neurocore_id')
    .eq('id', tenantId)
    .single();

  if (tenantError) {
    console.error('[getAgentsByTenant] Error fetching tenant:', tenantError);
    throw tenantError;
  }

  const { data: agentsData, error: agentsError } = await supabase
    .from('agents')
    .select(`
      id,
      name,
      type,
      template_id,
      created_at,
      updated_at,
      id_neurocore
    `)
    .eq('id_neurocore', tenantData.neurocore_id)
    .order('name');

  if (agentsError) {
    console.error('[getAgentsByTenant] Error fetching agents:', JSON.stringify(agentsError, null, 2));
    throw agentsError;
  }

  if (!agentsData || agentsData.length === 0) {
    return [];
  }

  // Buscar os prompts do tenant para esses agents
  const agentIds = agentsData.map(a => a.id);

  const { data: promptsData, error: promptsError } = await supabase
    .from('agent_prompts')
    .select('*')
    .in('id_agent', agentIds)
    .eq('id_tenant', tenantId);

  if (promptsError) {
    console.error('[getAgentsByTenant] Error fetching agent prompts:', promptsError);
    // Não lançar erro - apenas retornar agents sem prompts
  }

  // Mapear prompts por agent_id
  const promptsMap = new Map();
  if (promptsData) {
    promptsData.forEach(prompt => {
      promptsMap.set(prompt.id_agent, prompt);
    });
  }

  // Combinar agents com seus prompts
  // Se não houver prompt do tenant, criar um vazio (será preenchido ao editar)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = agentsData.map((agent: any) => {
    const rawPrompt = promptsMap.get(agent.id);

    // Parse de TODOS os campos JSONB (podem vir como string ou já parseados)
    const prompt = rawPrompt ? {
      ...rawPrompt,
      // Campos JSONB - fazer parse
      limitations: parseJSONBField(rawPrompt.limitations),
      instructions: parseJSONBField(rawPrompt.instructions),
      guide_line: parseJSONBField(rawPrompt.guide_line),
      rules: parseJSONBField(rawPrompt.rules),
      others_instructions: parseJSONBField(rawPrompt.others_instructions),
      // Campos de personalidade já vêm como string/null - não precisam parse
      name: rawPrompt.name || null,
      age: rawPrompt.age || null,
      gender: rawPrompt.gender || null,
      objective: rawPrompt.objective || null,
      comunication: rawPrompt.comunication || null, // NOTA: typo no banco
      personality: rawPrompt.personality || null,
    } : {
      // Prompt vazio quando não existe
      id: '',
      id_agent: agent.id,
      id_tenant: tenantId,
      // JSONB vazios
      limitations: null,
      instructions: null,
      guide_line: null,
      rules: null,
      others_instructions: null,
      // Personalidade vazia
      name: null,
      age: null,
      gender: null,
      objective: null,
      comunication: null,
      personality: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      ...agent,
      template_name: null, // TODO: Implementar lookup do template quando necessário
      prompt,
      is_customized: checkIfCustomized(prompt),
    };
  }) as AgentWithPrompt[];

  return result;
}

/**
 * Parse de campos JSONB que podem vir como string ou já parseados
 */
function parseJSONBField(field: unknown): unknown {
  if (!field) return null;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return null;
    }
  }
  return field;
}

/**
 * Busca um agent específico com seu prompt personalizado do tenant
 */
export async function getAgentWithPrompt(agentId: string, tenantId: string) {
  const supabase = await createClient();

  // Buscar o agent
  const { data: agentData, error: agentError } = await supabase
    .from('agents')
    .select(`
      id,
      name,
      type,
      template_id,
      id_neurocore,
      created_at,
      updated_at
    `)
    .eq('id', agentId)
    .single();

  if (agentError) {
    console.error('Error fetching agent:', agentError);
    throw agentError;
  }

  if (!agentData) {
    throw new Error('Agent not found');
  }

  // Buscar o prompt do tenant para este agent
  const { data: promptData, error: promptError } = await supabase
    .from('agent_prompts')
    .select('*')
    .eq('id_agent', agentId)
    .eq('id_tenant', tenantId)
    .maybeSingle();

  if (promptError) {
    console.error('Error fetching agent prompt:', promptError);
    // Não lançar erro - usar prompt vazio
  }

  // Se não houver prompt, criar um vazio, senão parse TODOS os campos JSONB
  const prompt = promptData ? {
    ...promptData,
    // Parse campos JSONB
    limitations: parseJSONBField(promptData.limitations),
    instructions: parseJSONBField(promptData.instructions),
    guide_line: parseJSONBField(promptData.guide_line),
    rules: parseJSONBField(promptData.rules),
    others_instructions: parseJSONBField(promptData.others_instructions),
    // Campos de personalidade já vêm corretos
    name: promptData.name || null,
    age: promptData.age || null,
    gender: promptData.gender || null,
    objective: promptData.objective || null,
    comunication: promptData.comunication || null,
    personality: promptData.personality || null,
  } : {
    // Prompt vazio
    id: '',
    id_agent: agentId,
    id_tenant: tenantId,
    // JSONB vazios
    limitations: null,
    instructions: null,
    guide_line: null,
    rules: null,
    others_instructions: null,
    // Personalidade vazia
    name: null,
    age: null,
    gender: null,
    objective: null,
    comunication: null,
    personality: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };


  return {
    ...(agentData as unknown as Record<string, unknown>),
    template_name: null, // TODO: Implementar lookup do template
    prompt,
    is_customized: checkIfCustomized(prompt),
  } as AgentWithPrompt;
}

/**
 * Busca o prompt específico do tenant para um agent
 */
export async function getAgentPrompt(agentId: string, tenantId: string) {
  const supabase = await createClient();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('agent_prompts')
    .select('*')
    .eq('id_agent', agentId)
    .eq('id_tenant', tenantId)
    .single();
  
  if (error) {
    console.error('Error fetching agent prompt:', error);
    throw error;
  }
  
  return data;
}

/**
 * Busca o prompt base (configuração padrão) de um agent
 */
export async function getBaseAgentPrompt(agentId: string) {
  const supabase = await createClient();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('agent_prompts')
    .select('*')
    .eq('id_agent', agentId)
    .is('id_tenant', null)
    .single();
  
  if (error) {
    console.error('Error fetching base agent prompt:', error);
    throw error;
  }
  
  return data;
}

/**
 * Verifica se um prompt foi personalizado pelo tenant
 * Compara com a configuração base para detectar mudanças
 */
function checkIfCustomized(prompt: unknown): boolean {
  // Se não tiver prompt, não é customizado
  if (!prompt) return false;

  // TODO: Implementar lógica de comparação com prompt base
  // Por enquanto, assume que se tem dados, foi customizado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prompt as any;

  return !!(
    // JSONB fields
    (p.limitations && p.limitations.length > 0) ||
    (p.instructions && p.instructions.length > 0) ||
    (p.guide_line && p.guide_line.length > 0) ||
    (p.rules && p.rules.length > 0) ||
    (p.others_instructions && p.others_instructions.length > 0) ||
    // Personality fields
    p.name ||
    p.age ||
    p.gender ||
    p.objective ||
    p.comunication ||
    p.personality
  );
}
