/**
 * API Route: Message Content Search
 *
 * GET /api/livechat/search-messages?q=termo&tenantId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchMessagesByContent } from '@/lib/queries/livechat';
import { z } from 'zod';

const searchParamsSchema = z.object({
  q:        z.string().min(3, 'Query mínima de 3 caracteres').max(100),
  tenantId: z.string().uuid('tenantId inválido'),
  limit:    z.coerce.number().int().min(1).max(50).optional().default(20),
  offset:   z.coerce.number().int().min(0).optional().default(0),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = searchParamsSchema.safeParse({
      q:        searchParams.get('q'),
      tenantId: searchParams.get('tenantId'),
      limit:    searchParams.get('limit') ?? undefined,
      offset:   searchParams.get('offset') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Parâmetros inválidos',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { q, tenantId, limit, offset } = parsed.data;

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const userTenantId = (userData as { tenant_id?: string })?.tenant_id;

    if (userTenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const results = await searchMessagesByContent(tenantId, q, limit, offset);

    return NextResponse.json({ results, query: q, total: results.length });

  } catch (error) {
    console.error('Error in GET /api/livechat/search-messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
