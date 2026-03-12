import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const signupSchema = z.object({
  full_name: z.string().min(2, { message: 'Nome deve ter ao menos 2 caracteres' }),
  email:     z.string().email({ message: 'Email inválido' }),
  password:  z
    .string()
    .min(8,          { message: 'Senha deve ter ao menos 8 caracteres' })
    .regex(/[A-Z]/,  { message: 'Senha deve conter ao menos uma letra maiúscula' })
    .regex(/[0-9]/,  { message: 'Senha deve conter ao menos um número' })
    .regex(/^[A-Za-z0-9]+$/, { message: 'Senha deve conter apenas letras e números' }),
});

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { full_name, email, password } = parsed.data;

  const adminClient = createAdminClient();

  // Criar usuário no Supabase Auth (confirmado automaticamente)
  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

  if (authError || !authData.user) {
    console.error('[signup] auth.admin.createUser error:', authError);
    if (authError?.message?.includes('already registered')) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: authError?.message ?? 'Erro ao criar conta. Tente novamente.' },
      { status: 500 }
    );
  }

  // Inserir em public.users sem tenant (aguardando owner liberar acesso)
  // Gera invite_code único para o usuário compartilhar com o owner
  let inviteCode = generateInviteCode();
  let retries = 3;
  let insertOk = false;

  while (retries > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (adminClient as any)
      .from('users')
      .insert({
        id:          authData.user.id,
        email,
        full_name,
        tenant_id:   null,
        role:        'user',
        modules:     [],
        invite_code: inviteCode,
      });

    if (!insertError) {
      insertOk = true;
      break;
    }

    if (insertError.code === '23505' && insertError.message?.includes('invite_code')) {
      inviteCode = generateInviteCode();
      retries--;
      continue;
    }

    // Erro desconhecido: rollback do auth user
    console.error('[signup] insert public.users error:', insertError);
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json(
      { error: `Erro ao finalizar cadastro: ${insertError.message}` },
      { status: 500 }
    );
  }

  if (!insertOk) {
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json(
      { error: 'Erro ao finalizar cadastro. Tente novamente.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
