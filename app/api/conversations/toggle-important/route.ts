/**
 * API Route: Toggle Conversation Important
 *
 * Marks or unmarks a conversation as important.
 * POST /api/conversations/toggle-important
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, tenantId, isImportant } = body;

    if (!conversationId || !tenantId || typeof isImportant !== 'boolean') {
      return NextResponse.json(
        { error: 'conversationId, tenantId e isImportant são obrigatórios' },
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
      .update({ is_important: isImportant })
      .eq('id', conversationId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[toggle-important] Update error:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar conversa' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: isImportant ? 'Conversa marcada como importante' : 'Importância removida',
    });

  } catch (error) {
    console.error('[toggle-important] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
