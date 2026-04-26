import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { moveConversationToStage } from '@/lib/queries/pipeline';

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .single();

  if (!userData?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const body = await req.json();
  const { conversation_id, stage_id } = body;

  if (!conversation_id) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 });

  const ok = await moveConversationToStage(
    conversation_id,
    userData.tenant_id,
    stage_id ?? null,
    authData.user.id
  );

  if (!ok) return NextResponse.json({ error: 'Failed to move' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
