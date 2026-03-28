/**
 * lib/utils/scheduling-webhooks.ts
 *
 * Webhooks n8n do Módulo de Agendamentos.
 * Segue o padrão estabelecido em lib/utils/n8n-webhooks.ts.
 *
 * Variáveis de ambiente necessárias:
 *   WEBHOOK_N8N_SCHEDULING_AUTOMATIONS      — confirmação, lembretes, reengajamento
 *   WEBHOOK_N8N_SCHEDULING_EXPIRE_HOLDS     — cron a cada 5min para expirar holds
 *   WEBHOOK_N8N_SCHEDULING_CONFIRMATION_SWEEP — cron para checar pendências
 *   WEBHOOK_N8N_SCHEDULING_REENGAGE         — reengajamento pós no-show
 */

import { callN8nWebhook } from '@/lib/utils/n8n-webhooks';
import type { SchedulingAutomationPayload } from '@/types/scheduling';

/**
 * Dispara automação de agendamento no n8n.
 * Chamado em: confirmar, cancelar, reagendar, completar, no-show.
 *
 * O n8n usa automation_config para decidir:
 * - enviar mensagem de confirmação/cancelamento ao contato
 * - agendar lembretes
 * - reengajar em caso de no-show
 */
export async function triggerSchedulingAutomation(payload: SchedulingAutomationPayload) {
  return callN8nWebhook(
    process.env.WEBHOOK_N8N_SCHEDULING_AUTOMATIONS || '/webhook/livia/scheduling-automations',
    payload
  );
}

/**
 * Dispara cron de expiração de holds.
 * Chamado pelo endpoint /api/agendamentos/expire-holds (acionado pelo n8n a cada 5min).
 */
export async function triggerExpireHolds(tenantId?: string | null) {
  return callN8nWebhook(
    process.env.WEBHOOK_N8N_SCHEDULING_EXPIRE_HOLDS || '/webhook/livia/scheduling-expire-holds',
    { tenant_id: tenantId ?? null }
  );
}

/**
 * Dispara sweep de confirmação.
 * Verifica agendamentos pendentes de confirmação e aplica política (manter/cancelar/reagendar).
 */
export async function triggerConfirmationSweep(tenantId?: string | null) {
  return callN8nWebhook(
    process.env.WEBHOOK_N8N_SCHEDULING_CONFIRMATION_SWEEP ||
      '/webhook/livia/scheduling-confirmation-sweep',
    { tenant_id: tenantId ?? null }
  );
}

/**
 * Dispara reengajamento pós no-show.
 * Envia mensagem tentando reagendar o contato que faltou.
 */
export async function triggerReengage(payload: {
  tenant_id: string;
  appointment_id: string;
  contact_id: string;
}) {
  return callN8nWebhook(
    process.env.WEBHOOK_N8N_SCHEDULING_REENGAGE || '/webhook/livia/scheduling-reengage',
    payload
  );
}
