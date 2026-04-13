import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPixPayment } from '@/lib/mercadopago/pix';

const SUBSCRIPTION_AMOUNT_CENTS = 30000; // R$ 300,00

const createPixSchema = z.union([
  z.object({
    mode: z.literal('subscription'),
  }),
  z.object({
    mode: z.literal('credit_purchase').optional(),
    packageId: z.string().uuid({ message: 'packageId inválido' }).optional(),
    customAmountCents: z.number().int().min(50).optional(),
  }).refine(
    (data) => data.packageId || data.customAmountCents,
    { message: 'Informe packageId ou customAmountCents' }
  ),
]);

/**
 * POST /api/mercadopago/pix/create
 *
 * Cria um pagamento PIX para recarga de créditos.
 * Retorna QR code e dados para exibição.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. AUTH
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    // 2. TENANT
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      return NextResponse.json({ error: 'Tenant não encontrado', code: 'tenant_not_found' }, { status: 404 });
    }

    const tenantId = userData.tenant_id;
    const payerEmail = user.email ?? 'pagador@livia.app';

    // 3. VALIDAÇÃO
    const body = await request.json();
    const parsed = createPixSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? 'Dados inválidos', code: 'validation_error' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 4. RESOLVE VALORES CONFORME MODO
    let amountCents: number;
    let credits: number;
    let description: string;
    let paymentType: 'credit_purchase' | 'subscription';

    if (parsed.data.mode === 'subscription') {
      amountCents = SUBSCRIPTION_AMOUNT_CENTS;
      credits = 0;
      description = 'Manutenção Mensal LIVIA — R$ 300,00';
      paymentType = 'subscription';
    } else if (parsed.data.packageId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pkg, error: pkgError } = await (adminSupabase as any)
        .from('credit_packages')
        .select('price_brl_cents, credits, bonus_credits, name')
        .eq('id', parsed.data.packageId)
        .eq('is_active', true)
        .single();

      if (pkgError || !pkg) {
        return NextResponse.json({ error: 'Pacote não encontrado', code: 'not_found' }, { status: 404 });
      }

      amountCents = pkg.price_brl_cents;
      credits = pkg.credits + (pkg.bonus_credits || 0);
      description = `${pkg.name} — ${credits.toLocaleString('pt-BR')} créditos LIVIA`;
      paymentType = 'credit_purchase';
    } else {
      amountCents = parsed.data.customAmountCents!;
      credits = amountCents;
      description = `Recarga personalizada — R$ ${(amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} LIVIA`;
      paymentType = 'credit_purchase';
    }

    // 5. LIMITE PIX (R$ 3.000,00)
    if (amountCents > 300000) {
      return NextResponse.json(
        { error: 'Valor máximo para PIX é R$ 3.000,00', code: 'pix_limit_exceeded' },
        { status: 400 }
      );
    }

    // 6. CRIA PAGAMENTO NO MERCADO PAGO
    const pixResult = await createPixPayment({
      tenantId,
      amountCents,
      credits,
      payerEmail,
      description,
      type: paymentType,
      expirationMinutes: paymentType === 'subscription' ? 60 : 30,
    });

    // 7. SALVA NO DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (adminSupabase as any)
      .from('mp_pix_payments')
      .insert({
        tenant_id: tenantId,
        mp_payment_id: pixResult.paymentId,
        payment_type: 'credit_purchase',
        status: 'pending',
        amount_cents: amountCents,
        credits,
        qr_code: pixResult.qrCode,
        qr_code_base64: pixResult.qrCodeBase64,
        expires_at: pixResult.expiresAt,
        meta: {
          package_id: 'packageId' in parsed.data ? (parsed.data.packageId ?? null) : null,
          description,
          payer_email: payerEmail,
        },
      });

    if (insertError) {
      console.error('[mp/pix/create] Erro ao salvar no DB:', insertError);
      return NextResponse.json({ error: 'Erro interno', code: 'db_error' }, { status: 500 });
    }

    return NextResponse.json({
      payment_id: pixResult.paymentId,
      qr_code: pixResult.qrCode,
      qr_code_base64: pixResult.qrCodeBase64,
      expires_at: pixResult.expiresAt,
      amount_cents: amountCents,
      credits,
    });
  } catch (error) {
    const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}));
    console.error('[mp/pix/create] Error:', serialized);
    return NextResponse.json({ error: serialized, code: 'internal_error' }, { status: 500 });
  }
}
