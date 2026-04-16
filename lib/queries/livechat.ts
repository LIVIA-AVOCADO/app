/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Livechat Queries - Funções de busca para o Livechat
 *
 * IMPORTANTE: Todas as queries validam tenant_id para multi-tenancy
 */

import { createClient } from '@/lib/supabase/server';
import type {
  ContactWithConversations,
  ConversationWithLastMessage,
  ConversationWithContact,
  MessageWithSender,
  ContactFilters,
  ConversationFilters,
  LivechatTabStatusCounts,
  MessageSearchResult,
} from '@/types/livechat';
import type { QuickReplyTemplate } from '@/types/database-helpers';

/**
 * Contagens das abas do livechat via agregação SQL (sem teto do PostgREST).
 * Retorna null se a RPC não existir (migração não aplicada) ou falhar.
 */
export async function getLivechatTabStatusCounts(
  tenantId: string
): Promise<LivechatTabStatusCounts | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('livechat_conversation_status_counts', {
    p_tenant_id: tenantId,
  });

  if (error) {
    console.warn('[getLivechatTabStatusCounts] RPC indisponível ou erro — badges usam lista local.', {
      message: error.message,
      code: (error as { code?: string }).code,
    });
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;

  const r = row as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

  return {
    ia: n(r.ia_count),
    manual: n(r.manual_count),
    closed: n(r.closed_count),
    important: n(r.important_count),
    unreadManual: n(r.unread_manual_count),
  };
}

/**
 * Busca contatos com conversas
 *
 * Query otimizada em 2 passos para evitar buscar todas as mensagens:
 * 1. Busca contatos com conversas (apenas metadados)
 * 2. Busca última mensagem de cada conversa (query separada eficiente)
 *
 * @param tenantId - ID do tenant (OBRIGATÓRIO para multi-tenancy)
 * @param filters - Filtros opcionais (includeClosedConversations para incluir conversas encerradas)
 * @returns Lista de contatos com conversas e última mensagem
 */
export async function getContactsWithConversations(
  tenantId: string,
  filters?: ContactFilters
): Promise<ContactWithConversations[]> {
  const supabase = await createClient();

  // ===== PASSO 1: Buscar contatos com conversas (sem mensagens) =====
  let query = supabase
    .from('contacts')
    .select(`
      *,
      conversations!inner(
        id,
        status,
        ia_active,
        last_message_at,
        created_at,
        updated_at,
        contact_id,
        tenant_id,
        channel_id,
        pause_notes,
        conversation_pause_reason_id
      )
    `)
    .eq('tenant_id', tenantId);

  // Filtrar conversas encerradas apenas se includeClosedConversations for false/undefined
  if (!filters?.includeClosedConversations) {
    query = query.neq('conversations.status', 'closed');
  }

  // Aplicar filtros
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data: contactsData, error: contactsError } = await query;

  if (contactsError) throw contactsError;
  if (!contactsData || contactsData.length === 0) return [];

  // ===== PASSO 2: Buscar última mensagem de cada conversa =====
  // Coletar IDs de todas as conversas
  const conversationIds = contactsData.flatMap((contact: any) =>
    (contact.conversations || []).map((conv: any) => conv.id)
  );

  // Se não houver conversas, retornar contatos sem mensagens
  if (conversationIds.length === 0) {
    return contactsData.map((contact: any) => ({
      ...contact,
      activeConversations: (contact.conversations || []).map((conv: any) => ({
        ...conv,
        lastMessage: null,
      })),
    })) as ContactWithConversations[];
  }

  // Buscar última mensagem de cada conversa (ordenada por timestamp DESC)
  const { data: messagesData, error: messagesError } = await supabase
    .from('messages')
    .select('id, conversation_id, content, timestamp, sender_type, sender_user_id')
    .in('conversation_id', conversationIds)
    .order('timestamp', { ascending: false });

  if (messagesError) throw messagesError;

  // ===== PASSO 3: Agrupar mensagens por conversation_id =====
  // Usar Map para pegar apenas a primeira mensagem (mais recente) de cada conversa
  const lastMessageMap = new Map<string, any>();

  messagesData?.forEach((msg) => {
    // Adicionar apenas se ainda não tiver mensagem para essa conversa
    // (como está ordenado DESC, a primeira é a mais recente)
    if (!lastMessageMap.has(msg.conversation_id)) {
      lastMessageMap.set(msg.conversation_id, msg);
    }
  });

  // ===== PASSO 4: Montar estrutura final =====
  // TODO: REFATORAÇÃO NECESSÁRIA - Ver docs/LIVECHAT_CONVERSATION_CARDS_REFACTOR.md
  // Atualmente retorna contatos com conversas agregadas, mas deveria retornar
  // uma conversa por card (mesmo contato pode ter múltiplos cards)
  return contactsData.map((contact: any) => ({
    ...contact,
    activeConversations: (contact.conversations || [])
      .map((conv: any) => ({
        ...conv,
        lastMessage: lastMessageMap.get(conv.id) || null,
      })),
  })) as ContactWithConversations[];
}

/**
 * Busca conversas com dados do contato
 *
 * NOVA QUERY (2025-11-22): Busca por CONVERSAS (não contatos).
 * Cada conversa é um card na UI. Mesmo contato pode ter múltiplos cards.
 *
 * Ver: docs/LIVECHAT_CONVERSATION_CARDS_REFACTOR.md
 *
 * @param tenantId - ID do tenant (OBRIGATÓRIO para multi-tenancy)
 * @param filters - Filtros opcionais
 * @returns Lista de conversas com dados do contato e última mensagem
 */
export async function getConversationsWithContact(
  tenantId: string,
  filters?: ConversationFilters
): Promise<ConversationWithContact[]> {
  const supabase = await createClient();

  // ===== PASSO 1: Buscar conversas com JOIN para contatos, tags e última mensagem =====
  // A última mensagem é embutida diretamente (limit 1 por conversa, ordenada DESC)
  // Isso elimina a query separada com .in([N UUIDs]) que estourava o limite de URL do PostgREST
  let query = supabase
    .from('conversations')
    .select(`
      *,
      contacts!inner(
        id,
        name,
        phone,
        email,
        status,
        is_muted
      ),
      conversation_tags(
        id,
        tag_id,
        tag:tags(
          id,
          tag_name,
          tag_type,
          color,
          is_category,
          order_index,
          id_neurocore
        )
      ),
      messages(
        id,
        conversation_id,
        content,
        timestamp,
        sender_type,
        sender_user_id
      ),
      channels(
        id,
        name,
        identification_number,
        channel_provider_id
      )
    `)
    .eq('tenant_id', tenantId)
    .order('timestamp', { referencedTable: 'messages', ascending: false })
    .limit(1, { referencedTable: 'messages' });

  // Filtrar conversas encerradas apenas se includeClosedConversations for false/undefined
  if (!filters?.includeClosedConversations) {
    query = query.neq('status', 'closed');
  }

  // Aplicar filtros
  if (filters?.search) {
    // Busca no nome ou phone do contato (relacionamento)
    query = query.or(
      `contacts.name.ilike.%${filters.search}%,contacts.phone.ilike.%${filters.search}%`
    );
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.isImportant !== undefined) {
    query = query.eq('is_important', filters.isImportant);
  }

  // Ordenar conversas pela última mensagem mais recente
  query = query.order('last_message_at', { ascending: false, nullsFirst: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  // eslint-disable-next-line prefer-const
  let { data: conversationsData, error: conversationsError } = await query;

  if (conversationsError) {
    console.error('[getConversationsWithContact] conversations query failed:', {
      message: conversationsError.message,
      code: (conversationsError as any).code,
      details: (conversationsError as any).details,
      hint: (conversationsError as any).hint,
      tenantId,
    });
    throw conversationsError;
  }
  if (!conversationsData || conversationsData.length === 0) return [];

  const requestedLimit = filters?.limit;
  if (
    requestedLimit != null &&
    conversationsData.length >= requestedLimit
  ) {
    console.warn(
      '[getConversationsWithContact] Retorno com tamanho igual ou superior ao limit solicitado — pode existir mais conversas. Considere paginação ou aumentar o limit / API max rows no Supabase.',
      { tenantId, count: conversationsData.length, requestedLimit }
    );
  }

  // ===== Excluir contatos silenciados da lista principal =====
  // Filtro em JS pois PostgREST não suporta filtros em colunas novas de relacionamentos facilmente
  conversationsData = conversationsData.filter(
    (conv: any) => !conv.contacts?.is_muted
  );

  // ===== Filtrar por categoria (se especificado) =====
  // Nota: Filtro aplicado aqui porque Supabase não suporta filtros em relacionamentos aninhados facilmente
  if (filters?.categoryId) {
    conversationsData = conversationsData.filter((conv: unknown) => {
      const convData = conv as { conversation_tags?: Array<{ tag?: { id: string; is_category?: boolean } }> };
      const tags = convData.conversation_tags || [];
      return tags.some((ct) => ct.tag?.id === filters.categoryId && ct.tag?.is_category);
    });
  }

  // ===== PASSO 2: Montar estrutura final =====
  // messages[] é um array de 1 item (limit 1 por conversa) — pegamos o [0]
  const result = conversationsData.map((conv: any) => {
    // Extrair categoria (primeira tag com is_category=true)
    const category = conv.conversation_tags
      ?.map((ct: any) => ct.tag)
      .filter((tag: any) => tag && tag.is_category)
      .sort((a: any, b: any) => a.order_index - b.order_index)[0] || null;

    return {
      ...conv,
      contact: conv.contacts, // Dados do contato (JOIN)
      lastMessage: conv.messages?.[0] || null,
      conversation_tags: conv.conversation_tags || [],
      category,
      channel: conv.channels || null,
    };
  });

  return result as ConversationWithContact[];
}

/**
 * Busca mensagens por conteúdo dentro de um tenant via RPC (pg_trgm + GIN index).
 * Query mínima: 3 caracteres. Tenant isolation via JOIN conversations.
 */
export async function searchMessagesByContent(
  tenantId: string,
  query: string,
  limit = 20,
  offset = 0
): Promise<MessageSearchResult[]> {
  if (query.trim().length < 3) return [];

  const supabase = await createClient();

  const { data, error } = await (supabase as any).rpc('search_messages_by_content', {
    p_tenant_id: tenantId,
    p_query:     query.trim(),
    p_limit:     limit,
    p_offset:    offset,
  });

  if (error) {
    console.error('[searchMessagesByContent] RPC error:', {
      message: error.message,
      code: (error as { code?: string }).code,
      tenantId,
      query,
    });
    throw error;
  }

  return (data || []) as MessageSearchResult[];
}

/**
 * Busca mensagens de uma conversa
 * @param conversationId - ID da conversa
 * @param limit - Número máximo de mensagens (padrão: 50)
 */
export async function getMessages(
  conversationId: string,
  limit = 50
): Promise<MessageWithSender[]> {
  const supabase = await createClient();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (supabase as any)
    .from('messages')
    .select(`
      *,
      senderUser:users!messages_sender_user_id_fkey(
        id,
        full_name,
        avatar_url
      ),
      message_attachments(
        id,
        attachment_type,
        storage_bucket,
        storage_path,
        file_name,
        mime_type,
        file_size_bytes,
        duration_ms
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

  if (error) throw error;

  const messages = (data || []).reverse().map((msg: any) => ({
    ...msg,
    attachment: msg.message_attachments?.[0] ?? null,
    message_attachments: undefined,
    quotedMessage: msg.quotedMessage ?? null,
  }));

  return messages as MessageWithSender[];
}

/**
 * Busca conversa por ID com validação de tenant
 * @param conversationId - ID da conversa
 * @param tenantId - ID do tenant (validação)
 */
export async function getConversation(
  conversationId: string,
  tenantId: string
): Promise<ConversationWithLastMessage | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      conversation_tags(
        id,
        tag_id,
        tag:tags(
          id,
          tag_name,
          tag_type,
          color,
          is_category,
          order_index,
          id_neurocore
        )
      )
    `)
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  if (!data) return null;

  // Nota: lastMessage não é populado aqui pois a página sempre chama getMessages() depois
  // Para melhor performance, buscamos apenas os dados da conversa + tags
  const conversation = data as any;
  return {
    ...conversation,
    lastMessage: null,
  } as ConversationWithLastMessage;
}

/**
 * Busca quick replies do tenant
 * @param tenantId - ID do tenant
 */
export async function getQuickReplies(
  tenantId: string
): Promise<QuickReplyTemplate[]> {
  const supabase = await createClient();

  const { data, error} = await supabase
    .from('quick_reply_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('usage_count', { ascending: false })
    .limit(10);

  if (error) throw error;

  return data || [];
}

/**
 * Busca contato por ID
 * @param contactId - ID do contato
 * @param tenantId - ID do tenant (validação)
 */
export async function getContact(contactId: string, tenantId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) throw error;

  return data;
}

/**
 * Busca categorias (tags com is_category=true) do neurocore
 * @param neurocoreId - ID do neurocore
 * @returns Lista de categorias ordenadas por order_index
 * @deprecated Use getAllTags() instead for better tag type support
 */
export async function getCategories(neurocoreId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('id_neurocore', neurocoreId)
    .eq('is_category', true)
    .eq('active', true)
    .order('order_index', { ascending: true });

  if (error) throw error;

  return data || [];
}

/**
 * Busca TODAS as tags ativas disponíveis para o tenant:
 * - Tags próprias do tenant (tenant_id = tenantId)
 * - Tags herdadas do neurocore (id_neurocore = neurocoreId AND tenant_id IS NULL)
 *
 * Sem deduplicação: tags próprias e herdadas são entidades distintas.
 * A query OR evita duplicatas que ocorriam quando createTag gravava
 * id_neurocore no registro do tenant, fazendo a busca por neurocoreId
 * retornar tanto as herdadas quanto as próprias.
 *
 * @param neurocoreId - ID do neurocore do tenant
 * @param tenantId - ID do tenant (necessário para incluir tags próprias)
 * @returns Lista de todas as tags ativas, ordenadas por tipo e order_index
 */
export async function getAllTags(neurocoreId: string, tenantId: string) {
  const supabase = await createClient();

  // Tags próprias do tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantTags, error: tenantError } = await (supabase as any)
    .from('tags')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('tag_type', { ascending: true })
    .order('order_index', { ascending: true });

  if (tenantError) throw tenantError;

  // Tags herdadas do neurocore (sem tenant_id — são compartilhadas)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: neurocoreTags, error: neurocoreError } = await (supabase as any)
    .from('tags')
    .select('*')
    .eq('id_neurocore', neurocoreId)
    .is('tenant_id', null)
    .eq('active', true)
    .order('tag_type', { ascending: true })
    .order('order_index', { ascending: true });

  if (neurocoreError) throw neurocoreError;

  // Neurocore primeiro (herdadas), depois as próprias do tenant
  return [...(neurocoreTags || []), ...(tenantTags || [])];
}
