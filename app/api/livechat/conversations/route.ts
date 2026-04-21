import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getConversationsWithContact } from '@/lib/queries/inbox';

/**
 * GET /api/livechat/conversations?filter=closed&limit=300&offset=0
 *
 * Busca conversas por filtro — usado pelo ContactList para lazy loading
 * das abas que não são carregadas no SSR inicial (ex.: Encerradas).
 *
 * Parâmetros:
 *   filter  — "closed" (obrigatório por ora)
 *   limit   — número de conversas (padrão 300, máximo 500)
 *   offset  — para paginação (padrão 0)
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

  const params = request.nextUrl.searchParams;
  const filter = params.get('filter');
  const limit = Math.min(parseInt(params.get('limit') ?? '300'), 500);
  const offset = parseInt(params.get('offset') ?? '0');

  if (filter !== 'closed') {
    return NextResponse.json({ error: 'Invalid filter — only "closed" supported' }, { status: 400 });
  }

  try {
    const conversations = await getConversationsWithContact(tenantId, {
      includeClosedConversations: true,
      status: 'closed',
      limit,
      offset,
    });

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error('[api/livechat/conversations] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
