import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getConversationsWithContact,
  getMessages,
  getAllTags,
} from '@/lib/queries/livechat';
import { LivechatContent } from '@/components/livechat/livechat-content';

interface LivechatPageProps {
  searchParams: Promise<{ conversation?: string }>;
}

export default async function LivechatPage({
  searchParams,
}: LivechatPageProps) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id, full_name, email, avatar_url')
    .eq('id', authData.user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantId = (userData as any)?.tenant_id;
  if (!tenantId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">
          Erro: Usuário sem tenant associado
        </p>
      </div>
    );
  }

  const { data: tenantData } = await supabase
    .from('tenants')
    .select('neurocore_id')
    .eq('id', tenantId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const neurocoreId = (tenantData as any)?.neurocore_id;
  if (!neurocoreId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">
          Erro: Tenant sem neurocore associado
        </p>
      </div>
    );
  }

  // Paraleliza as duas queries independentes (ganho ~200-400ms no load inicial)
  const [conversations, allTags] = await Promise.all([
    getConversationsWithContact(tenantId, { includeClosedConversations: true }),
    getAllTags(neurocoreId),
  ]);

  const resolvedParams = await searchParams;
  const selectedConversationId = resolvedParams.conversation;

  // Encontra a conversa selecionada na lista (sem query extra ao banco)
  const selectedConversation = selectedConversationId
    ? (conversations.find((c) => c.id === selectedConversationId) ?? null)
    : null;

  // Busca mensagens apenas para o carregamento inicial (SSR)
  // Trocas subsequentes de conversa usam a API client-side (/api/livechat/messages)
  const messages = selectedConversation
    ? await getMessages(selectedConversation.id)
    : null;

  return (
    <LivechatContent
      conversations={conversations}
      selectedConversationId={selectedConversationId}
      tenantId={tenantId}
      selectedConversation={selectedConversation}
      messages={messages}
      allTags={allTags}
    />
  );
}
