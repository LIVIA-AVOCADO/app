import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', origin));
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/login?error=auth_failed', origin)
    );
  }

  const user = data.user;

  const { data: existingUser } = await supabase
    .from('users')
    .select('id, tenant_id')
    .eq('id', user.id)
    .single();

  if (existingUser) {
    if (existingUser.tenant_id) {
      return NextResponse.redirect(new URL('/inbox', origin));
    }
    return NextResponse.redirect(new URL('/aguardando-acesso', origin));
  }

  const adminClient = createAdminClient();

  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Usuário';

  const avatarUrl = user.user_metadata?.avatar_url || null;

  let inviteCode = generateInviteCode();
  let retries = 3;

  while (retries > 0) {
    const { error: insertError } = await adminClient.from('users').insert({
      id: user.id,
      email: user.email!,
      full_name: fullName,
      avatar_url: avatarUrl,
      tenant_id: null,
      modules: [],
      role: 'user',
      invite_code: inviteCode,
    });

    if (!insertError) break;

    if (
      insertError.code === '23505' &&
      insertError.message?.includes('invite_code')
    ) {
      inviteCode = generateInviteCode();
      retries--;
      continue;
    }

    console.error('Error creating user record:', insertError);
    return NextResponse.redirect(
      new URL('/login?error=registration_failed', origin)
    );
  }

  return NextResponse.redirect(new URL('/aguardando-acesso', origin));
}
