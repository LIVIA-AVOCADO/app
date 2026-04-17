import { describe, it, expect } from 'vitest';
import {
  agentPromptSchema,
  guidelineStepSchema,
  guidelineSubInstructionSchema,
} from '../agentPromptValidation';

describe('guidelineSubInstructionSchema', () => {
  it('aceita sub-instrução válida', () => {
    const result = guidelineSubInstructionSchema.safeParse({
      content: 'Sempre cumprimentar o cliente',
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita content com mais de 2000 caracteres', () => {
    const result = guidelineSubInstructionSchema.safeParse({
      content: 'x'.repeat(2001),
      active: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Máximo 2000 caracteres');
  });

  it('aceita content vazio', () => {
    const result = guidelineSubInstructionSchema.safeParse({ content: '', active: false });
    expect(result.success).toBe(true);
  });
});

describe('guidelineStepSchema', () => {
  const validStep = {
    title: 'Saudação inicial',
    type: 'markdown' as const,
    active: true,
    sub: [],
  };

  it('aceita step válido', () => {
    expect(guidelineStepSchema.safeParse(validStep).success).toBe(true);
  });

  it('aceita type rank e markdown', () => {
    for (const type of ['rank', 'markdown']) {
      expect(guidelineStepSchema.safeParse({ ...validStep, type }).success).toBe(true);
    }
  });

  it('rejeita type inválido', () => {
    const result = guidelineStepSchema.safeParse({ ...validStep, type: 'invalido' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Tipo deve ser "rank" ou "markdown"');
  });

  it('rejeita title com mais de 300 caracteres', () => {
    const result = guidelineStepSchema.safeParse({ ...validStep, title: 'x'.repeat(301) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Máximo 300 caracteres');
  });

  it('aceita sub com sub-instruções válidas', () => {
    const result = guidelineStepSchema.safeParse({
      ...validStep,
      sub: [{ content: 'Instrução 1', active: true }],
    });
    expect(result.success).toBe(true);
  });
});

describe('agentPromptSchema', () => {
  it('aceita objeto completamente vazio (todos os campos são opcionais)', () => {
    expect(agentPromptSchema.safeParse({}).success).toBe(true);
  });

  it('aceita todos os campos preenchidos', () => {
    const result = agentPromptSchema.safeParse({
      name: 'Livia',
      age: '25',
      gender: 'female',
      objective: 'Atender clientes com excelência',
      comunication: 'Informal e amigável',
      personality: 'Proativa e empática',
      limitations: [],
      instructions: [],
      guide_line: [],
      rules: [],
      others_instructions: [],
    });
    expect(result.success).toBe(true);
  });

  it('aceita gender male e female', () => {
    for (const gender of ['male', 'female']) {
      expect(agentPromptSchema.safeParse({ gender }).success).toBe(true);
    }
  });

  it('rejeita gender inválido', () => {
    const result = agentPromptSchema.safeParse({ gender: 'other' });
    expect(result.success).toBe(false);
  });

  it('aceita gender nulo', () => {
    const result = agentPromptSchema.safeParse({ gender: null });
    expect(result.success).toBe(true);
  });

  it('rejeita name com mais de 200 caracteres', () => {
    const result = agentPromptSchema.safeParse({ name: 'x'.repeat(201) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Máximo 200 caracteres');
  });

  it('rejeita objective com mais de 1000 caracteres', () => {
    const result = agentPromptSchema.safeParse({ objective: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Máximo 1000 caracteres');
  });

  it('aceita limitations com guideline steps válidos', () => {
    const result = agentPromptSchema.safeParse({
      limitations: [
        {
          title: 'Limite 1',
          type: 'markdown',
          active: true,
          sub: [{ content: 'Não falar sobre preços', active: true }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('aceita arrays nulos', () => {
    const result = agentPromptSchema.safeParse({
      limitations: null,
      instructions: null,
      guide_line: null,
    });
    expect(result.success).toBe(true);
  });
});
