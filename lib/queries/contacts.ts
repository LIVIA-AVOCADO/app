/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Contact Queries
 * Operações relacionadas a contatos e seus dados
 */

import { createClient } from '@/lib/supabase/server';
import type { Contact } from '@/types/database-helpers';
import type { ContactBulkUpdatePayload } from '@/types/livechat';

/**
 * Busca contato por ID
 * @param contactId - ID do contato
 * @param tenantId - ID do tenant (validação de segurança)
 */
export async function getContactById(
  contactId: string,
  tenantId: string
): Promise<Contact | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    console.error('Error fetching contact:', error);
    return null;
  }

  return data as Contact;
}

/**
 * Atualiza dados do contato
 * @param contactId - ID do contato
 * @param tenantId - ID do tenant (validação de segurança)
 * @param payload - Dados a serem atualizados
 * @param userId - ID do usuário que está fazendo a alteração
 */
export async function updateContact(
  contactId: string,
  tenantId: string,
  payload: ContactBulkUpdatePayload,
  userId: string
): Promise<Contact | null> {
  const supabase = await createClient();

  // 1. Buscar valores atuais para auditoria
  const currentContact = await getContactById(contactId, tenantId);
  if (!currentContact) return null;

  // 2. Atualizar contato
  const { data: updatedContact, error: updateError } = await supabase
    .from('contacts')
    .update({
      name: payload.name,
      email: payload.email,
      cpf: payload.cpf,
      phone_secondary: payload.phone_secondary,
      address_street: payload.address_street,
      address_number: payload.address_number,
      address_complement: payload.address_complement,
      city: payload.city,
      zip_code: payload.zip_code,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating contact:', updateError);
    return null;
  }

  // 3. Registrar mudanças em contact_data_changes (auditoria)
  const changes = [];

  if (payload.name !== currentContact.name) {
    changes.push({
      field_name: 'name',
      old_value: currentContact.name,
      new_value: payload.name,
    });
  }
  if (payload.email !== currentContact.email) {
    changes.push({
      field_name: 'email',
      old_value: currentContact.email,
      new_value: payload.email,
    });
  }
  if (payload.cpf !== currentContact.cpf) {
    changes.push({
      field_name: 'cpf',
      old_value: currentContact.cpf,
      new_value: payload.cpf,
    });
  }
  if (payload.phone_secondary !== currentContact.phone_secondary) {
    changes.push({
      field_name: 'phone_secondary',
      old_value: currentContact.phone_secondary,
      new_value: payload.phone_secondary,
    });
  }
  if (payload.address_street !== currentContact.address_street) {
    changes.push({
      field_name: 'address_street',
      old_value: currentContact.address_street,
      new_value: payload.address_street,
    });
  }
  if (payload.address_number !== currentContact.address_number) {
    changes.push({
      field_name: 'address_number',
      old_value: currentContact.address_number,
      new_value: payload.address_number,
    });
  }
  if (payload.address_complement !== currentContact.address_complement) {
    changes.push({
      field_name: 'address_complement',
      old_value: currentContact.address_complement,
      new_value: payload.address_complement,
    });
  }
  if (payload.city !== currentContact.city) {
    changes.push({
      field_name: 'city',
      old_value: currentContact.city,
      new_value: payload.city,
    });
  }
  if (payload.zip_code !== currentContact.zip_code) {
    changes.push({
      field_name: 'zip_code',
      old_value: currentContact.zip_code,
      new_value: payload.zip_code,
    });
  }

  // 4. Inserir mudanças na tabela de auditoria
  // NOTA: Requer execução do SQL em docs/sql-contact-data-changes.sql
  if (changes.length > 0) {
    const changeRecords = changes.map((change) => ({
      tenant_id: tenantId,
      contact_id: contactId,
      field_name: change.field_name,
      old_value: change.old_value,
      new_value: change.new_value,
      changed_by: userId,
    }));

    // Tentativa de inserir auditoria (falha silenciosa se tabela não existir)
    try {
      await (supabase as any)
        .from('contact_data_changes')
        .insert(changeRecords);
    } catch (auditError) {
      console.warn('Contact audit logging skipped (table may not exist):', auditError);
      // Não retorna erro pois a atualização principal foi bem-sucedida
    }
  }

  return updatedContact as Contact;
}

// ── Contact list with search + pagination ─────────────────────────────────────

const PAGE_SIZE = 50;

export interface ContactsPage {
  contacts: Contact[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getContactsPage(
  tenantId: string,
  search: string,
  page: number
): Promise<ContactsPage> {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })
    .range(from, to);

  if (search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(`name.ilike.${s},phone.ilike.${s},email.ilike.${s}`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching contacts page:', error);
    return { contacts: [], total: 0, page, totalPages: 0 };
  }

  const total = count ?? 0;
  return {
    contacts: (data || []) as Contact[],
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export async function getContactWithDetails(contactId: string, tenantId: string) {
  const supabase = await createClient();

  const [contactRes, conversationsRes, notesRes, fieldDefsRes, fieldValuesRes] =
    await Promise.all([
      supabase.from('contacts').select('*').eq('id', contactId).eq('tenant_id', tenantId).single(),
      supabase
        .from('conversations')
        .select('id, status, ia_active, last_message_at, created_at, pipeline_stage_id')
        .eq('contact_id', contactId)
        .eq('tenant_id', tenantId)
        .order('last_message_at', { ascending: false })
        .limit(20),
      (supabase as any)
        .from('contact_notes')
        .select('*')
        .eq('contact_id', contactId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      (supabase as any)
        .from('contact_field_definitions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('display_order', { ascending: true }),
      (supabase as any)
        .from('contact_field_values')
        .select('*')
        .eq('contact_id', contactId)
        .eq('tenant_id', tenantId),
    ]);

  if (contactRes.error || !contactRes.data) return null;

  return {
    contact: contactRes.data as Contact,
    conversations: (conversationsRes.data || []) as any[],
    notes: (notesRes.data || []) as any[],
    fieldDefs: (fieldDefsRes.data || []) as any[],
    fieldValues: (fieldValuesRes.data || []) as any[],
  };
}
