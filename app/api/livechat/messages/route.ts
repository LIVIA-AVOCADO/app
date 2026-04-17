import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/livechat/messages?conversationId=xxx
 *
 * Busca mensagens de uma conversa para uso client-side (sem SSR).
 * Usado pelo useMessagesCache para evitar reload SSR ao trocar de conversa.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantId = (userData as any)?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 403 });
  }

  const conversationId = request.nextUrl.searchParams.get('conversationId');
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
  }

  const before = request.nextUrl.searchParams.get('before');
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam), 100) : 50;

  // Valida que a conversa pertence ao tenant (segurança multi-tenant)
  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!conv) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('messages')
    .select(`
      *,
      senderUser:users!messages_sender_user_id_fkey(
        id,
        full_name,
        avatar_url
      ),
      quotedMessage:messages!messages_quoted_message_id_fkey(
        id,
        content,
        sender_type,
        senderUser:users!messages_sender_user_id_fkey(
          id,
          full_name,
          avatar_url
        )
      )
    `)
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('timestamp', before);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reverter para ordem cronológica (mais antigas primeiro)
  const messages = (data || []).reverse();

  return NextResponse.json({ messages });
}
