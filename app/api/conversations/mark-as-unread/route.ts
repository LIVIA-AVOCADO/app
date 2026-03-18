/**
 * API Route: Mark Conversation as Unread
 *
 * Marks a conversation as unread (sets has_unread = true, unread_count = 1)
 * POST /api/conversations/mark-as-unread
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, tenantId } = body;

    if (!conversationId || !tenantId) {
      return NextResponse.json(
        { error: 'conversationId e tenantId são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        has_unread: true,
        unread_count: 1,
      })
      .eq('id', conversationId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[mark-as-unread] Update error:', updateError);
      return NextResponse.json(
        { error: 'Erro ao marcar como não lida' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Conversa marcada como não lida',
    });

  } catch (error) {
    console.error('[mark-as-unread] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
