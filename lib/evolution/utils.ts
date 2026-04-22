/**
 * lib/evolution/utils.ts
 *
 * Tipos e helpers compartilhados entre client.ts e as rotas de conexão.
 */

import type { EvolutionCreds } from './client';

export type EvolutionConnectionState =
  | 'open'
  | 'close'
  | 'connecting'
  | 'refused';  // retornado quando o limite de QR é atingido

export type ChannelConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/** Mapeia estado bruto da Evolution para o status interno do canal. */
export function mapConnectionState(state: string): ChannelConnectionStatus {
  if (state === 'open')       return 'connected';
  if (state === 'connecting') return 'connecting';
  return 'disconnected';
}

/**
 * Extrai credenciais Evolution do config_json do canal.
 * Usa env vars como fallback para canais criados antes do suporte multi-instância.
 * Garante que operações em canais existentes usem a Evolution correta,
 * independente de mudanças nas env vars globais.
 */
export function credsFromConfigJson(configJson: unknown): EvolutionCreds {
  const cfg = configJson as Record<string, string> | null;
  return {
    baseUrl: cfg?.evolution_api_url ?? process.env.EVOLUTION_API_BASE_URL!,
    apiKey:  cfg?.evolution_api_key ?? process.env.EVOLUTION_API_KEY!,
  };
}
