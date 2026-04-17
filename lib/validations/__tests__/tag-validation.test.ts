import { describe, it, expect } from 'vitest';
import { createTagSchema, updateTagSchema } from '../tag-validation';

const validTag = {
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  tag_name: 'Suporte',
  tag_type: 'description' as const,
  color: '#3b82f6',
  active: true,
  is_category: false,
  send_text: false,
  pause_ia_on_apply: false,
};

describe('createTagSchema', () => {
  it('aceita tag válida', () => {
    expect(createTagSchema.safeParse(validTag).success).toBe(true);
  });

  it('rejeita tag_name vazio', () => {
    const result = createTagSchema.safeParse({ ...validTag, tag_name: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Nome é obrigatório');
  });

  it('rejeita tag_name com mais de 100 caracteres', () => {
    const result = createTagSchema.safeParse({ ...validTag, tag_name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Nome muito longo');
  });

  it('rejeita tag_type inválido', () => {
    const result = createTagSchema.safeParse({ ...validTag, tag_type: 'invalido' });
    expect(result.success).toBe(false);
  });

  it('aceita todos os tag_type válidos', () => {
    for (const type of ['description', 'success', 'fail']) {
      const result = createTagSchema.safeParse({ ...validTag, tag_type: type });
      expect(result.success).toBe(true);
    }
  });

  it('rejeita cor sem formato hex (#RRGGBB)', () => {
    const result = createTagSchema.safeParse({ ...validTag, color: 'azul' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Cor deve ser um hex válido (#RRGGBB)');
  });

  it('aceita cor em hex maiúsculo', () => {
    const result = createTagSchema.safeParse({ ...validTag, color: '#A1B2C3' });
    expect(result.success).toBe(true);
  });

  it('rejeita tenantId inválido (não UUID)', () => {
    const result = createTagSchema.safeParse({ ...validTag, tenantId: 'nao-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejeita send_text=true sem send_text_message', () => {
    const result = createTagSchema.safeParse({
      ...validTag,
      send_text: true,
      send_text_message: null,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      'Mensagem obrigatória quando envio de texto está ativo'
    );
  });

  it('rejeita send_text=true com send_text_message vazio', () => {
    const result = createTagSchema.safeParse({
      ...validTag,
      send_text: true,
      send_text_message: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('aceita send_text=true com send_text_message preenchida', () => {
    const result = createTagSchema.safeParse({
      ...validTag,
      send_text: true,
      send_text_message: 'Olá, como posso ajudar?',
    });
    expect(result.success).toBe(true);
  });

  it('aceita send_text=false sem send_text_message', () => {
    const result = createTagSchema.safeParse({
      ...validTag,
      send_text: false,
      send_text_message: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita prompt_to_ai com mais de 2000 caracteres', () => {
    const result = createTagSchema.safeParse({
      ...validTag,
      prompt_to_ai: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Instrução muito longa');
  });
});

describe('updateTagSchema', () => {
  it('aceita objeto vazio (todos os campos são opcionais)', () => {
    expect(updateTagSchema.safeParse({}).success).toBe(true);
  });

  it('aceita atualização parcial', () => {
    const result = updateTagSchema.safeParse({ tag_name: 'Novo Nome' });
    expect(result.success).toBe(true);
  });

  it('rejeita send_text=true sem send_text_message mesmo em update', () => {
    const result = updateTagSchema.safeParse({
      send_text: true,
      send_text_message: '',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      'Mensagem obrigatória quando envio de texto está ativo'
    );
  });

  it('aceita send_text=false sem verificar send_text_message', () => {
    const result = updateTagSchema.safeParse({ send_text: false });
    expect(result.success).toBe(true);
  });

  it('ignora a regra de send_text quando send_text não está presente', () => {
    const result = updateTagSchema.safeParse({ tag_name: 'Nome' });
    expect(result.success).toBe(true);
  });
});
