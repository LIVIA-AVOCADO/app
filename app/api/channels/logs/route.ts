import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (supabase as any)
    .from('users')
    .select('tenant_id, role, modules')
    .eq('id', user.id)
    .single();

  if (!userData?.tenant_id) {
    return NextResponse.json({ error: 'No tenant' }, { status: 403 });
  }

  const modules = (userData.modules as string[]) ?? [];
  const isAdmin = userData.role === 'super_admin';
  if (!isAdmin && !modules.includes('conexoes') && !modules.includes('conexoes-view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const channelId  = searchParams.get('channel_id');
  const eventType  = searchParams.get('event_type');
  const dateFrom   = searchParams.get('date_from');
  const dateTo     = searchParams.get('date_to');
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const admin = createAdminClient();
  const from  = (page - 1) * PAGE_SIZE;
  const to    = from + PAGE_SIZE - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('channel_connection_logs')
    .select(`
      id, tenant_id, channel_id, event_type, event_data, source, created_at,
      channel:channels(id, name)
    `, { count: 'exact' })
    .eq('tenant_id', userData.tenant_id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (channelId)  query = query.eq('channel_id', channelId);
  if (eventType)  query = query.eq('event_type', eventType);
  if (dateFrom)   query = query.gte('created_at', dateFrom);
  if (dateTo)     query = query.lte('created_at', dateTo);

  const { data, count, error } = await query;

  if (error) {
    console.error('[channels/logs] query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  return NextResponse.json({
    logs:       data ?? [],
    total:      count ?? 0,
    page,
    pageSize:   PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
