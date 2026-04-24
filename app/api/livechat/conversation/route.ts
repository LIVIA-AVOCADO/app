import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/livechat/conversation?id=xxx
 *
 * Busca uma única conversa com dados completos (contact, channel, tags).
 * Usado para abrir conversas que não estão na lista principal (ex.: silenciadas).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (supabase as any)
    .from('users')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .single();

  const tenantId = userData?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant' }, { status: 403 });
  }

  const conversationId = request.nextUrl.searchParams.get('id');
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data, error } = await db
    .from('conversations')
    .select(`
      *,
      contacts(
        id, name, phone, email, status, is_muted, mute_reason
      ),
      channels(
        id, name, identification_number,
        channel_provider_id,
        channel_providers(
          id, name,
          channel_types(id, name, display_name)
        )
      ),
      conversation_tags(
        id, tag_id,
        tag:tags(
          id, tag_name, tag_type, color, is_category, order_index, id_neurocore
        )
      )
    `)
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const category = data.conversation_tags
    ?.map((ct: { tag: unknown }) => ct.tag)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((tag: any) => tag && tag.is_category)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => a.order_index - b.order_index)[0] ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conv = data as any;
  const channel = conv.channels
    ? {
        id: conv.channels.id,
        name: conv.channels.name,
        identification_number: conv.channels.identification_number,
        channel_provider_id: conv.channels.channel_provider_id,
      }
    : null;

  const conversation = {
    ...conv,
    contact: conv.contacts,
    lastMessage: null,
    conversation_tags: conv.conversation_tags ?? [],
    category,
    channel,
    contacts: undefined,
    channels: undefined,
  };

  return NextResponse.json({ conversation });
}
