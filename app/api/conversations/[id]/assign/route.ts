import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/conversations/[id]/assign
// Body: { userId: string | null, tenantId: string }
// userId null = remover atribuição
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: conversationId } = await params;
  const body = await request.json().catch(() => ({}));
  const { userId, tenantId } = body as { userId: string | null; tenantId: string };

  if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('conversations')
    .update({
      assigned_to: userId ?? null,
      assigned_at: userId ? new Date().toISOString() : null,
    })
    .eq('id', conversationId)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Registra no histórico de atribuições
  if (userId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('conversation_assignments')
      .insert({
        conversation_id: conversationId,
        assigned_by: user.id,
        reason: 'manual',
      });
  }

  return NextResponse.json({ conversationId, assignedTo: userId });
}
