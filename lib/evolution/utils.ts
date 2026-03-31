/**
 * lib/evolution/utils.ts
 *
 * Tipos e helpers compartilhados entre client.ts e as rotas de conexão.
 */

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
