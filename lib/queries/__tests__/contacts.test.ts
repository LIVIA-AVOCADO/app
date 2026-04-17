import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQueryBuilder, createServerSupabaseMock } from '@/lib/__tests__/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { getContactById, updateContact } from '../contacts';

const mockCreateClient = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
});

const mockContact = {
  id: 'contact-1',
  tenant_id: 'tenant-1',
  name: 'João Silva',
  email: 'joao@example.com',
  phone: '5511999999999',
  cpf: null,
  phone_secondary: null,
  address_street: null,
  address_number: null,
  address_complement: null,
  city: null,
  zip_code: null,
  status: 'open',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ===== getContactById =====

describe('getContactById', () => {
  it('retorna contato quando encontrado', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: mockContact, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getContactById('contact-1', 'tenant-1');
    expect(result).toEqual(mockContact);
  });

  it('retorna null em caso de erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { code: 'PGRST116' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getContactById('contact-inexistente', 'tenant-1');
    expect(result).toBeNull();
  });

  it('filtra por id e tenant_id', async () => {
    const mock = createServerSupabaseMock();
    const qb = createQueryBuilder({ data: mockContact, error: null });
    mock.from.mockReturnValue(qb);
    mockCreateClient.mockResolvedValue(mock as any);

    await getContactById('contact-1', 'tenant-xyz');
    expect(qb.eq).toHaveBeenCalledWith('id', 'contact-1');
    expect(qb.eq).toHaveBeenCalledWith('tenant_id', 'tenant-xyz');
  });

  it('retorna null para erros genéricos (não lança exceção)', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'DB Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getContactById('contact-1', 'tenant-1');
    expect(result).toBeNull();
  });
});

// ===== updateContact =====

describe('updateContact', () => {
  const updatePayload = {
    name: 'João Atualizado',
    email: 'joao.novo@example.com',
    cpf: null,
    phone_secondary: null,
    address_street: 'Rua Nova',
    address_number: '123',
    address_complement: null,
    city: 'São Paulo',
    zip_code: '01001-000',
  };

  it('retorna null se contato não existir', async () => {
    const mock = createServerSupabaseMock();
    // getContactById retorna null (contato não encontrado)
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { code: 'PGRST116' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await updateContact('contact-inexistente', 'tenant-1', updatePayload, 'user-1');
    expect(result).toBeNull();
  });

  it('retorna contato atualizado quando bem-sucedido', async () => {
    const updatedContact = { ...mockContact, name: 'João Atualizado' };
    const mock = createServerSupabaseMock();

    // Primeira chamada: getContactById retorna contato atual
    // Segunda chamada: update retorna contato atualizado
    // Terceira chamada: insert na auditoria (pode falhar silenciosamente)
    mock.from
      .mockReturnValueOnce(createQueryBuilder({ data: mockContact, error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: updatedContact, error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: null }));

    mockCreateClient.mockResolvedValue(mock as any);

    const result = await updateContact('contact-1', 'tenant-1', updatePayload, 'user-1');
    expect(result).toEqual(updatedContact);
  });

  it('retorna null quando update falha', async () => {
    const mock = createServerSupabaseMock();
    mock.from
      .mockReturnValueOnce(createQueryBuilder({ data: mockContact, error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: { message: 'Update Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await updateContact('contact-1', 'tenant-1', updatePayload, 'user-1');
    expect(result).toBeNull();
  });

  it('registra auditoria quando nome muda', async () => {
    const updatedContact = { ...mockContact, name: 'João Atualizado' };
    const mock = createServerSupabaseMock();
    const auditQb = createQueryBuilder({ data: null, error: null });

    mock.from
      .mockReturnValueOnce(createQueryBuilder({ data: mockContact, error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: updatedContact, error: null }))
      .mockReturnValueOnce(auditQb);

    mockCreateClient.mockResolvedValue(mock as any);

    await updateContact('contact-1', 'tenant-1', { ...updatePayload, name: 'João Atualizado' }, 'user-1');

    // Verifica que insert de auditoria foi chamado
    expect(auditQb.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          field_name: 'name',
          old_value: 'João Silva',
          new_value: 'João Atualizado',
          changed_by: 'user-1',
        }),
      ])
    );
  });

  it('não registra auditoria quando nada muda', async () => {
    // Payload igual ao contato atual
    const unchangedPayload = {
      name: mockContact.name,
      email: mockContact.email,
      cpf: mockContact.cpf,
      phone_secondary: mockContact.phone_secondary,
      address_street: mockContact.address_street,
      address_number: mockContact.address_number,
      address_complement: mockContact.address_complement,
      city: mockContact.city,
      zip_code: mockContact.zip_code,
    };

    const mock = createServerSupabaseMock();
    const updateQb = createQueryBuilder({ data: mockContact, error: null });
    mock.from
      .mockReturnValueOnce(createQueryBuilder({ data: mockContact, error: null }))
      .mockReturnValueOnce(updateQb);
    mockCreateClient.mockResolvedValue(mock as any);

    await updateContact('contact-1', 'tenant-1', unchangedPayload, 'user-1');

    // from() não deve ter sido chamado uma 3a vez (auditoria não inserida)
    expect(mock.from).toHaveBeenCalledTimes(2);
  });
});
