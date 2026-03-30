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
  return res.json() as Promise<EvolutionStateResponse>;
}

/** GET /instance/fetchInstances/{name} — detalhes do perfil conectado */
export async function fetchInstance(instanceName: string): Promise<EvolutionInstanceInfo | null> {
  const res = await fetch(`${BASE}/instance/fetchInstances?instanceName=${instanceName}`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  const data = await res.json() as EvolutionInstanceInfo[] | EvolutionInstanceInfo;
  const list = Array.isArray(data) ? data : [data];
  return list[0] ?? null;
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
