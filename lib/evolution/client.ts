/**
 * lib/evolution/client.ts
 *
 * Cliente centralizado para chamadas à Evolution API v2.
 * Todas as rotas de conexão importam daqui — sem duplicação de URL/apikey.
 */

const BASE = process.env.EVOLUTION_API_BASE_URL!;
const KEY  = process.env.EVOLUTION_API_KEY!;

function headers() {
  return {
    'Content-Type': 'application/json',
    apikey: KEY,
  };
}

export type EvolutionConnectionState = 'open' | 'close' | 'connecting';

export interface EvolutionStateResponse {
  instance: {
    instanceName: string;
    state: EvolutionConnectionState;
  };
}

export interface EvolutionInstanceInfo {
  instance: {
    instanceName: string;
    owner?: string;         // número conectado (ex: 5511999999999)
    profileName?: string;
    profilePictureUrl?: string;
    connectionStatus: EvolutionConnectionState;
  };
}

// Formato real retornado pela Evolution v2 em /instance/fetchInstances
interface RawFetchInstance {
  id?: string;
  name: string;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  connectionStatus?: string;
}

interface RawInstance { name: string; token?: string; }

/**
 * Resolve o nome real da instância na Evolution.
 * O DB pode armazenar o token legado (ex: "DF95B747EA0F-...") em vez do nome
 * ("Sergio_teste"). Tenta o valor direto primeiro; se 404, busca pelo token.
 */
export async function resolveInstanceName(nameOrToken: string): Promise<string> {
  // Testa se já é um nome válido
  const probe = await fetch(`${BASE}/instance/connectionState/${encodeURIComponent(nameOrToken)}`, {
    headers: headers(),
  });
  if (probe.ok) return nameOrToken;

  // Fallback: busca todas e acha pelo token
  const all = await fetch(`${BASE}/instance/fetchInstances`, { headers: headers() });
  if (!all.ok) return nameOrToken; // retorna o original se tudo falhar
  const list = await all.json() as RawInstance[];
  const match = list.find((i) => i.token === nameOrToken || i.name === nameOrToken);
  return match?.name ?? nameOrToken;
}

/** GET /instance/connectionState/{name} */
export async function getConnectionState(instanceName: string): Promise<EvolutionStateResponse> {
  const res = await fetch(`${BASE}/instance/connectionState/${instanceName}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Evolution connectionState error: ${res.status}`);
  // Evolution v2 pode retornar { instance: { state } } ou { state } no nível raiz
  const data = await res.json() as { instance?: { state?: string }; state?: string };
  const state = (data?.instance?.state ?? data?.state ?? 'close') as EvolutionConnectionState;
  return { instance: { instanceName, state } };
}

/** GET /instance/fetchInstances?instanceName={name} — detalhes do perfil conectado */
export async function fetchInstance(instanceName: string): Promise<EvolutionInstanceInfo | null> {
  const res = await fetch(`${BASE}/instance/fetchInstances?instanceName=${instanceName}`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  const data = await res.json() as RawFetchInstance[] | RawFetchInstance;
  const list = Array.isArray(data) ? data : [data];
  const raw = list[0];
  if (!raw) return null;
  return {
    instance: {
      instanceName: raw.name ?? instanceName,
      owner:              raw.ownerJid?.split('@')[0],
      profileName:        raw.profileName,
      profilePictureUrl:  raw.profilePicUrl,
      connectionStatus:   (raw.connectionStatus ?? 'close') as EvolutionConnectionState,
    },
  };
}

/**
 * GET /instance/fetchInstances?instanceName={name}
 * Retorna o UUID interno (id) da instância na Evolution.
 * Necessário para salvar em config_json.instance.
 */
export async function fetchInstanceId(instanceName: string): Promise<string | null> {
  const res = await fetch(`${BASE}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  const data = await res.json() as RawFetchInstance[] | RawFetchInstance;
  const list = Array.isArray(data) ? data : [data];
  return list[0]?.id ?? null;
}

/** POST /instance/restart/{name} */
export async function restartInstance(instanceName: string): Promise<void> {
  const res = await fetch(`${BASE}/instance/restart/${instanceName}`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Evolution restart error: ${res.status}`);
}

/** DELETE /instance/logout/{name} — desvincula número, mantém instância */
export async function logoutInstance(instanceName: string): Promise<void> {
  const res = await fetch(`${BASE}/instance/logout/${instanceName}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Evolution logout error: ${res.status}`);
}

/** GET /instance/connect/{name} — retorna QR code para nova conexão */
export async function connectInstance(instanceName: string): Promise<{ base64: string; pairingCode?: string }> {
  const res = await fetch(`${BASE}/instance/connect/${instanceName}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Evolution connect error: ${res.status}`);
  return res.json() as Promise<{ base64: string; pairingCode?: string }>;
}

/**
 * POST /webhook/set/{name}
 *
 * Configura o webhook da instância apontando para o n8n first integrator.
 * URL montada a partir de N8N_BASE_URL + N8N_FIRST_INTEGRATOR_WEBHOOK.
 * Ativa base64, byEvents, MESSAGES_UPSERT e CONNECTION_UPDATE.
 *
 * Payload correto para Evolution v2: wrapper "webhook" com campos
 * byEvents e base64 (não webhook_by_events/webhook_base64).
 */
export async function configureInstanceWebhook(instanceName: string): Promise<void> {
  // Usa URL completa via EVOLUTION_INSTANCE_WEBHOOK_URL (preferencial)
  // ou monta a partir de N8N_BASE_URL + N8N_FIRST_INTEGRATOR_WEBHOOK
  const webhookUrl =
    process.env.EVOLUTION_INSTANCE_WEBHOOK_URL ||
    ((process.env.N8N_BASE_URL ?? '') + (process.env.N8N_FIRST_INTEGRATOR_WEBHOOK ?? ''));

  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    console.error(`[evolution/configureWebhook] ${instanceName}: EVOLUTION_INSTANCE_WEBHOOK_URL não configurado ou inválido (valor: "${webhookUrl}")`);
    return;
  }

  const payload = {
    webhook: {
      enabled:  true,
      url:      webhookUrl,
      byEvents: true,
      base64:   true,
      events:   ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
    },
  };

  const res = await fetch(`${BASE}/webhook/set/${encodeURIComponent(instanceName)}`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[evolution/configureWebhook] ${instanceName}: ${res.status} url=${webhookUrl}`, text);
  } else {
    console.log(`[evolution/configureWebhook] ${instanceName}: webhook configurado → ${webhookUrl}`);
  }
}

/**
 * POST /settings/set/{name}
 *
 * Aplica as configurações padrão LIVIA na instância:
 * - Rejeitar chamadas + mensagem de resposta
 * - Ignorar grupos
 * - Não marcar como online permanente
 * - Não marcar mensagens/status como lidos automaticamente
 * - Não sincronizar histórico completo
 */
export async function configureInstanceSettings(instanceName: string): Promise<void> {
  const payload = {
    rejectCall:      true,
    msgCall:         'No momento só consigo falar por mensagens...',
    groupsIgnore:    true,
    alwaysOnline:    false,
    readMessages:    false,
    readStatus:      false,
    syncFullHistory: false,
  };

  const res = await fetch(`${BASE}/settings/set/${encodeURIComponent(instanceName)}`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[evolution/configureSettings] ${instanceName}: ${res.status}`, text);
  }
}
