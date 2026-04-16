import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getMPAccessToken } from '@/lib/mercadopago/client';
import { calcularProximoVencimento } from '@/lib/mercadopago/pix';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe/client';

/**
 * POST /api/mercadopago/webhook
 *
 * Recebe notificações do Mercado Pago.
 * Trata: credit_purchase aprovado, subscription aprovado, cancelamentos.
 *
 * Segurança: verificação de assinatura HMAC-SHA256 via x-signature + x-request-id.
 * Sem auth de usuário — usa service role no Supabase.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // 1. VERIFICA ASSINATURA MP
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (webhookSecret) {
    const xSignature = request.headers.get('x-signature') ?? '';
    const xRequestId = request.headers.get('x-request-id') ?? '';
    const dataId = new URL(request.url).searchParams.get('data.id') ?? '';

    const signedTemplate = `id:${dataId};request-id:${xRequestId};ts:${xSignature.split(',').find(p => p.startsWith('ts='))?.split('=')[1] ?? ''};`;
    const ts = xSignature.split(',').find(p => p.startsWith('ts='))?.split('=')[1] ?? '';
    const v1 = xSignature.split(',').find(p => p.startsWith('v1='))?.split('=')[1] ?? '';

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(manifest)
      .digest('hex');

    if (v1 && expectedSig !== v1) {
      console.error('[mp/webhook] Assinatura inválida');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
    void signedTemplate; // suppress unused warning
  }

  // 2. PARSE DO PAYLOAD
  let payload: { type?: string; action?: string; data?: { id?: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Só trata eventos de pagamento
  if (payload.type !== 'payment') {
    return NextResponse.json({ received: true });
  }

  const mpPaymentId = payload.data?.id;
  if (!mpPaymentId) {
    return NextResponse.json({ received: true });
  }

  try {
    // 3. BUSCA DETALHES DO PAGAMENTO NO MP
    const accessToken = getMPAccessToken();
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!mpRes.ok) {
      console.error('[mp/webhook] Falha ao buscar pagamento:', mpPaymentId, mpRes.status);
      return NextResponse.json({ received: true });
    }
    const mpPayment = await mpRes.json();
    const mpStatus = mpPayment.status as string;
    const metadata = mpPayment.metadata as Record<string, unknown> | undefined;
    const tenantId = metadata?.tenant_id as string | undefined;
    const paymentType = metadata?.type as string | undefined;
    const credits = Number(metadata?.credits ?? 0);

    if (!tenantId) {
      console.error('[mp/webhook] tenant_id ausente no metadata', { mpPaymentId });
      return NextResponse.json({ received: true });
    }

    const adminSupabase = createAdminClient();

    // 4. ATUALIZA STATUS NO DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any)
      .from('mp_pix_payments')
      .update({ status: mpStatus })
      .eq('mp_payment_id', String(mpPaymentId));

    // 5. PROCESSA CONFORME TIPO
    if (mpStatus === 'approved') {
      if (paymentType === 'credit_purchase') {
        await handleCreditPurchaseApproved(adminSupabase, tenantId, credits, String(mpPaymentId));
      } else if (paymentType === 'subscription') {
        await handleSubscriptionApproved(adminSupabase, tenantId, String(mpPaymentId));
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[mp/webhook] Erro ao processar:', error);
    // Retorna 200 para evitar reenvio infinito do MP
    return NextResponse.json({ received: true });
  }
}

// ============================================================
// Handler: recarga de créditos aprovada
// ============================================================

async function handleCreditPurchaseApproved(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminSupabase: any,
  tenantId: string,
  credits: number,
  mpPaymentId: string
) {
  if (credits <= 0) return;

  const sourceRef = `mp_pix_${mpPaymentId}`;

  // Idempotência — evita crédito duplo se webhook disparar mais de uma vez
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (adminSupabase as any)
    .from('ledger_entries')
    .select('id')
    .eq('source_ref', sourceRef)
    .limit(1);

  if ((existing?.length ?? 0) > 0) {
    console.log('[mp/webhook] Já processado (idempotência):', sourceRef);
    return;
  }

  const { error: rpcError } = await adminSupabase.rpc('credit_wallet', {
    p_tenant_id: tenantId,
    p_amount_credits: credits,
    p_source_type: 'purchase',
    p_source_ref: sourceRef,
    p_description: `Recarga de ${credits.toLocaleString('pt-BR')} créditos via PIX`,
    p_meta: { mp_payment_id: mpPaymentId, provider: 'mercadopago' },
  });

  if (rpcError) {
    console.error('[mp/webhook] Erro ao creditar wallet:', rpcError);
    throw rpcError;
  }

  console.log('[mp/webhook] Créditos adicionados:', { tenantId, credits, sourceRef });
}

// ============================================================
// Handler: pagamento de assinatura aprovado
// ============================================================

async function handleSubscriptionApproved(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminSupabase: any,
  tenantId: string,
  mpPaymentId: string
) {
  // Busca tenant para checar status atual
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant, error: tenantError } = await (adminSupabase as any)
    .from('tenants')
    .select('subscription_provider, subscription_billing_day, subscription_current_period_end, stripe_subscription_id, subscription_status')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) {
    console.error('[mp/webhook] Tenant não encontrado:', tenantId);
    return;
  }

  // Cancela Stripe quando PIX é confirmado:
  // - past_due: cancela imediatamente para parar Smart Retry
  // - active com cancel_at_period_end: cancela para não ficar como "zumbi"
  if (tenant.stripe_subscription_id) {
    const shouldCancelStripe =
      tenant.subscription_status === 'past_due' ||
      (tenant.subscription_status === 'active' && tenant.subscription_provider === 'pix_manual');

    if (shouldCancelStripe) {
      try {
        await getStripe().subscriptions.cancel(tenant.stripe_subscription_id);
        console.log('[mp/webhook] Stripe subscription cancelada (PIX pago):', tenant.stripe_subscription_id);
      } catch (err) {
        // Se já foi cancelada, ignora
        console.warn('[mp/webhook] Erro ao cancelar Stripe (pode já estar cancelada):', err);
      }
    }
  }

  // Calcula próximo vencimento com base no billing_day
  // Se nova assinatura (sem period_end), usa o dia de hoje como âncora
  const hoje = new Date();
  const billingDay = tenant.subscription_billing_day ?? hoje.getUTCDate();
  const currentPeriodEnd = tenant.subscription_current_period_end
    ? new Date(tenant.subscription_current_period_end)
    : hoje;

  // Se o period_end já passou (ou não existe), o novo período começa de hoje
  const baseParaCalculo = currentPeriodEnd < hoje ? hoje : currentPeriodEnd;
  const proximoVencimento = calcularProximoVencimento(billingDay, baseParaCalculo);

  // Atualiza tenant — reseta cancel_at_period_end pois o PIX foi pago
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminSupabase as any)
    .from('tenants')
    .update({
      subscription_provider: 'pix_manual',
      subscription_status: 'active',
      subscription_current_period_end: proximoVencimento.toISOString(),
      subscription_cancel_at_period_end: false,
    })
    .eq('id', tenantId);

  console.log('[mp/webhook] Assinatura PIX renovada:', {
    tenantId,
    mpPaymentId,
    proximoVencimento,
  });
}
