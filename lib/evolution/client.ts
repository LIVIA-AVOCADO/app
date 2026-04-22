/**
 * lib/evolution/client.ts
 *
 * Cliente centralizado para chamadas à Evolution API v2.
 * Todas as rotas de conexão importam daqui — sem duplicação de URL/apikey.
 *
 * As funções aceitam `creds` opcional. Quando omitido, usam as env vars globais.
 * Rotas que operam em canais existentes devem passar creds lidas do config_json
 * do canal, garantindo isolamento entre instâncias Evolution distintas.
 */

import qrcode from 'qrcode';
import type { EvolutionConnectionState } from './utils';

export type { EvolutionConnectionState };

export interface EvolutionCreds {
  baseUrl: string;
  apiKey:  string;
}

function defaultCreds(): EvolutionCreds {
  return {
    baseUrl: process.env.EVOLUTION_API_BASE_URL!,
    apiKey:  process.env.EVOLUTION_API_KEY!,
  };
}

function headers(creds: EvolutionCreds) {
  return {
    'Content-Type': 'application/json',
    apikey: creds.apiKey,
  };
}

/**
 * Converte o `code` bruto retornado pela Evolution v2.3.6 em uma data URL SVG.
 * A Evolution retorna `code` (string raw do QR), não `base64`.
 */
async function codeToDataUrl(code: string): Promise<string> {
  const svg = await qrcode.toString(code, { type: 'svg' });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

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
export async function resolveInstanceName(nameOrToken: string, creds?: EvolutionCreds): Promise<string> {
  const c = creds ?? defaultCreds();
  const probe = await fetch(`${c.baseUrl}/instance/connectionState/${encodeURIComponent(nameOrToken)}`, {
    headers: headers(c),
  });
  if (probe.ok) return nameOrToken;

  const all = await fetch(`${c.baseUrl}/instance/fetchInstances`, { headers: headers(c) });
  if (!all.ok) return nameOrToken;
  const list = await all.json() as RawInstance[];
  const match = list.find((i) => i.token === nameOrToken || i.name === nameOrToken);
  return match?.name ?? nameOrToken;
}

/** GET /instance/connectionState/{name} */
export async function getConnectionState(instanceName: string, creds?: EvolutionCreds): Promise<EvolutionStateResponse> {
  const c = creds ?? defaultCreds();
  const res = await fetch(`${c.baseUrl}/instance/connectionState/${instanceName}`, {
    headers: headers(c),
  });
  if (!res.ok) throw new Error(`Evolution connectionState error: ${res.status}`);
  const data = await res.json() as { instance?: { state?: string }; state?: string };
  const state = (data?.instance?.state ?? data?.state ?? 'close') as EvolutionConnectionState;
  return { instance: { instanceName, state } };
}

/** GET /instance/fetchInstances?instanceName={name} — detalhes do perfil conectado */
export async function fetchInstance(instanceName: string, creds?: EvolutionCreds): Promise<EvolutionInstanceInfo | null> {
  const c = creds ?? defaultCreds();
  const res = await fetch(`${c.baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
    headers: headers(c),
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
 */
export async function fetchInstanceId(instanceName: string, creds?: EvolutionCreds): Promise<string | null> {
  const c = creds ?? defaultCreds();
  const res = await fetch(`${c.baseUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`, {
    headers: headers(c),
  });
  if (!res.ok) return null;
  const data = await res.json() as RawFetchInstance[] | RawFetchInstance;
  const list = Array.isArray(data) ? data : [data];
  return list[0]?.id ?? null;
}

/** PUT /instance/restart/{name} — Evolution v2.3.6 exige PUT */
export async function restartInstance(instanceName: string, creds?: EvolutionCreds): Promise<void> {
  const c = creds ?? defaultCreds();
  const res = await fetch(`${c.baseUrl}/instance/restart/${instanceName}`, {
    method: 'PUT',
    headers: headers(c),
  });
  if (!res.ok) throw new Error(`Evolution restart error: ${res.status}`);
}

/** DELETE /instance/logout/{name} — desvincula número, mantém instância */
export async function logoutInstance(instanceName: string, creds?: EvolutionCreds): Promise<void> {
  const c = creds ?? defaultCreds();
  const res = await fetch(`${c.baseUrl}/instance/logout/${instanceName}`, {
    method: 'DELETE',
    headers: headers(c),
  });
  if (!res.ok) throw new Error(`Evolution logout error: ${res.status}`);
}

/**
 * GET /instance/connect/{name} — retorna QR code para nova conexão.
 *
 * Evolution v2.3.6 retorna { code, pairingCode } — sem `base64`.
 * Convertemos `code` para data URL SVG mantendo a interface pública inalterada.
 */
export async function connectInstance(instanceName: string, creds?: EvolutionCreds): Promise<{ base64: string; pairingCode?: string }> {
  const c = creds ?? defaultCreds();
  const res = await fetch(`${c.baseUrl}/instance/connect/${instanceName}`, {
    headers: headers(c),
  });
  if (!res.ok) throw new Error(`Evolution connect error: ${res.status}`);
  const data = await res.json() as { base64?: string; code?: string; pairingCode?: string };
  const base64 = data.base64 ?? (data.code ? await codeToDataUrl(data.code) : '');
  return { base64, pairingCode: data.pairingCode };
}

/**
 * POST /webhook/set/{name}
 *
 * Configura o webhook da instância. A URL do webhook vem de
 * EVOLUTION_INSTANCE_WEBHOOK_URL (aponta para livia-gateway ou n8n).
 */
export async function configureInstanceWebhook(instanceName: string, creds?: EvolutionCreds): Promise<void> {
  const c = creds ?? defaultCreds();
  const webhookUrl = process.env.EVOLUTION_INSTANCE_WEBHOOK_URL;

  if (!webhookUrl || !webhookUrl.includes('/webhook/')) {
    console.error(
      `[evolution/configureWebhook] ${instanceName}: EVOLUTION_INSTANCE_WEBHOOK_URL ausente ou inválida.` +
      ` Valor atual: "${webhookUrl ?? '(não definido)'}".`
    );
    return;
  }

  const payload = {
    webhook: {
      enabled:  true,
      url:      webhookUrl,
      byEvents: false,
      base64:   true,
      events:   ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
    },
  };

  const res = await fetch(`${c.baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
    method:  'POST',
    headers: headers(c),
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[evolution/configureWebhook] ${instanceName}: ${res.status}`, text);
  } else {
    console.warn(`[evolution/configureWebhook] ${instanceName}: webhook → ${webhookUrl}`);
  }
}

/**
 * POST /settings/set/{name} — aplica configurações padrão LIVIA na instância.
 */
export async function configureInstanceSettings(instanceName: string, creds?: EvolutionCreds): Promise<void> {
  const c = creds ?? defaultCreds();
  const payload = {
    rejectCall:      true,
    msgCall:         'No momento só consigo falar por mensagens...',
    groupsIgnore:    true,
    alwaysOnline:    false,
    readMessages:    false,
    readStatus:      false,
    syncFullHistory: false,
  };

  const res = await fetch(`${c.baseUrl}/settings/set/${encodeURIComponent(instanceName)}`, {
    method:  'POST',
    headers: headers(c),
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[evolution/configureSettings] ${instanceName}: ${res.status}`, text);
  }
}
