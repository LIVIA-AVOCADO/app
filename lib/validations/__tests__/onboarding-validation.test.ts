import { describe, it, expect } from 'vitest';
import {
  createSessionSchema,
  saveStepSchema,
  companyStepSchema,
  agentStepSchema,
  knowledgeStepSchema,
  tagsStepSchema,
} from '../onboarding-validation';

describe('createSessionSchema', () => {
  it('aceita templateId UUID válido', () => {
    const result = createSessionSchema.safeParse({
      templateId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita templateId que não é UUID', () => {
    const result = createSessionSchema.safeParse({ templateId: 'nao-uuid' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Template inválido');
  });

  it('rejeita sem templateId', () => {
    const result = createSessionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('saveStepSchema', () => {
  it('aceita stepKey e stepPayload válidos', () => {
    const result = saveStepSchema.safeParse({
      stepKey: 'company',
      stepPayload: { trade_name: 'Empresa Teste' },
    });
    expect(result.success).toBe(true);
  });

  it('rejeita stepKey vazio', () => {
    const result = saveStepSchema.safeParse({
      stepKey: '',
      stepPayload: {},
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Step inválido');
  });

  it('aceita stepPayload vazio', () => {
    const result = saveStepSchema.safeParse({ stepKey: 'company', stepPayload: {} });
    expect(result.success).toBe(true);
  });
});

describe('companyStepSchema', () => {
  const validCompany = {
    trade_name: 'Empresa Teste',
    cnpj: '12345678000100',
    phone: '11999999999',
  };

  it('aceita dados válidos', () => {
    expect(companyStepSchema.safeParse(validCompany).success).toBe(true);
  });

  it('rejeita trade_name com menos de 2 caracteres', () => {
    const result = companyStepSchema.safeParse({ ...validCompany, trade_name: 'A' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Nome da empresa obrigatório');
  });

  it('rejeita cnpj com menos de 14 caracteres', () => {
    const result = companyStepSchema.safeParse({ ...validCompany, cnpj: '123' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('CNPJ inválido');
  });

  it('rejeita phone com menos de 10 caracteres', () => {
    const result = companyStepSchema.safeParse({ ...validCompany, phone: '119' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Telefone inválido');
  });

  it('aceita responsibles opcionais', () => {
    const result = companyStepSchema.safeParse({
      ...validCompany,
      responsibles: {
        technical: {
          name: 'João Silva',
          whatsapp: '11999999999',
          email: 'joao@empresa.com',
        },
        financial: {
          name: 'Maria Souza',
          whatsapp: '11988888888',
          email: 'maria@empresa.com',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejeita email inválido nos responsáveis', () => {
    const result = companyStepSchema.safeParse({
      ...validCompany,
      responsibles: {
        technical: {
          name: 'João Silva',
          whatsapp: '11999999999',
          email: 'nao-e-email',
        },
        financial: {
          name: 'Maria',
          whatsapp: '11988888888',
          email: 'maria@empresa.com',
        },
      },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Email inválido');
  });
});

describe('agentStepSchema', () => {
  const validAgent = {
    name: 'Assistente Livia',
    type: 'support',
  };

  it('aceita dados mínimos válidos', () => {
    expect(agentStepSchema.safeParse(validAgent).success).toBe(true);
  });

  it('rejeita name com menos de 2 caracteres', () => {
    const result = agentStepSchema.safeParse({ ...validAgent, name: 'A' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Nome do agente obrigatório');
  });

  it('rejeita type vazio', () => {
    const result = agentStepSchema.safeParse({ ...validAgent, type: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Tipo obrigatório');
  });

  it('aceita profile com objective válido', () => {
    const result = agentStepSchema.safeParse({
      ...validAgent,
      profile: {
        objective: 'Atender clientes com excelência e agilidade',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejeita profile.objective com menos de 10 caracteres', () => {
    const result = agentStepSchema.safeParse({
      ...validAgent,
      profile: { objective: 'Curto' },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Objetivo deve ter ao menos 10 caracteres');
  });
});

describe('knowledgeStepSchema', () => {
  it('aceita dados válidos', () => {
    const result = knowledgeStepSchema.safeParse({ name: 'Base de Suporte' });
    expect(result.success).toBe(true);
  });

  it('rejeita name com menos de 2 caracteres', () => {
    const result = knowledgeStepSchema.safeParse({ name: 'A' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Nome da base obrigatório');
  });

  it('aceita extra_information como array de strings', () => {
    const result = knowledgeStepSchema.safeParse({
      name: 'Base Teste',
      extra_information: ['info1', 'info2'],
    });
    expect(result.success).toBe(true);
  });
});

describe('tagsStepSchema', () => {
  it('aceita objeto vazio (items é opcional)', () => {
    expect(tagsStepSchema.safeParse({}).success).toBe(true);
  });

  it('aceita items com tags válidas', () => {
    const result = tagsStepSchema.safeParse({
      items: [{ tag_name: 'Urgente', color: '#ff0000' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejeita tag_name vazio', () => {
    const result = tagsStepSchema.safeParse({
      items: [{ tag_name: '' }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Nome da tag obrigatório');
  });

  it('usa color padrão #3b82f6 quando não informado', () => {
    const result = tagsStepSchema.safeParse({
      items: [{ tag_name: 'Suporte' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items?.[0].color).toBe('#3b82f6');
    }
  });
});
