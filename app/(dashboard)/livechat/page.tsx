import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getConversationsWithContact,
  getMessages,
  getAllTags,
  getLivechatTabStatusCounts,
} from '@/lib/queries/livechat';
import { LivechatContent } from '@/components/livechat/livechat-content';
import { LIVECHAT_INITIAL_CONVERSATIONS_LIMIT } from '@/config/constants';

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

  // Duas queries paralelas — conversas ativas + metadados.
  // Encerradas são carregadas client-side quando o usuário clica na aba (lazy).
  // Importantes já estão incluídas nas ativas; o contador vem da RPC abaixo.
  const [conversationsResult, allTagsResult, tabCountsResult] = await Promise.allSettled([
    getConversationsWithContact(tenantId, {
      limit: LIVECHAT_INITIAL_CONVERSATIONS_LIMIT,
    }),
    getAllTags(neurocoreId, tenantId),
    getLivechatTabStatusCounts(tenantId),
  ]);

  if (conversationsResult.status === 'rejected') {
    console.error('[livechat] getConversationsWithContact failed:', JSON.stringify(conversationsResult.reason));
    throw conversationsResult.reason;
  }
  if (allTagsResult.status === 'rejected') {
    console.error('[livechat] getAllTags failed:', JSON.stringify(allTagsResult.reason));
    throw allTagsResult.reason;
  }

  const conversations = conversationsResult.value;

  const allTags = allTagsResult.value;
  const tabStatusCounts = tabCountsResult.status === 'fulfilled' ? tabCountsResult.value : null;
  if (tabCountsResult.status === 'rejected') {
    console.warn('[livechat] getLivechatTabStatusCounts failed:', tabCountsResult.reason);
  }

  const resolvedParams = await searchParams;
  const selectedConversationId = resolvedParams.conversation;

  // Encontra a conversa selecionada na lista (sem query extra ao banco)
  const selectedConversation = selectedConversationId
    ? (conversations.find((c) => c.id === selectedConversationId) ?? null)
    : null;

  // Busca mensagens apenas para o carregamento inicial (SSR)
  // Trocas subsequentes de conversa usam a API client-side (/api/livechat/messages)
  let messages = null;
  if (selectedConversation) {
    try {
      messages = await getMessages(selectedConversation.id);
    } catch (err) {
      console.error('[livechat] getMessages failed:', JSON.stringify(err));
      messages = [];
    }
  }

  return (
    <LivechatContent
      conversations={conversations}
      selectedConversationId={selectedConversationId}
      tenantId={tenantId}
      selectedConversation={selectedConversation}
      messages={messages}
      allTags={allTags}
      tabStatusCounts={tabStatusCounts}
    />
  );
}
