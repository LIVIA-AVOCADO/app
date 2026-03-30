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
 * Configura o webhook da instância com base64 e byEvents habilitados.
 * A URL aponta sempre para /api/configuracoes/conexoes/webhook do app.
 */
export async function configureInstanceWebhook(instanceName: string, appUrl: string): Promise<void> {
  const webhookUrl = `${appUrl}/api/configuracoes/conexoes/webhook`;
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;

  const payload: Record<string, unknown> = {
    enabled:         true,
    url:             webhookUrl,
    webhook_by_events: true,
    webhook_base64:  true,
    events:          ['CONNECTION_UPDATE'],
  };

  if (secret) {
    payload.headers = { 'x-webhook-token': secret };
  }

  const res = await fetch(`${BASE}/webhook/set/${encodeURIComponent(instanceName)}`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[evolution/configureWebhook] ${instanceName}: ${res.status}`, text);
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
