import { describe, it, expect } from 'vitest';
import {
  reactivationSettingsSchema,
  reactivationStepSchema,
  reactivationFormSchema,
} from '../reactivationValidation';

describe('reactivationSettingsSchema', () => {
  const validSettings = {
    exhausted_action: 'end_conversation' as const,
    max_window_action: 'do_nothing' as const,
    reactivate_when_ia_active_false: false,
  };

  it('aceita configuração válida com defaults', () => {
    const result = reactivationSettingsSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
  });

  it('rejeita exhausted_action inválido', () => {
    const result = reactivationSettingsSchema.safeParse({
      ...validSettings,
      exhausted_action: 'invalido',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Selecione uma acao valida');
  });

  it('aceita todos os valores válidos de exhausted_action', () => {
    for (const action of ['end_conversation', 'transfer_to_human', 'do_nothing']) {
      const result = reactivationSettingsSchema.safeParse({
        ...validSettings,
        exhausted_action: action,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejeita max_reactivation_window_minutes abaixo de 1', () => {
    const result = reactivationSettingsSchema.safeParse({
      ...validSettings,
      max_reactivation_window_minutes: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Minimo 1 minuto');
  });

  it('rejeita max_reactivation_window_minutes acima de 43200', () => {
    const result = reactivationSettingsSchema.safeParse({
      ...validSettings,
      max_reactivation_window_minutes: 43201,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Maximo 30 dias (43200 minutos)');
  });

  it('aceita max_reactivation_window_minutes nulo', () => {
    const result = reactivationSettingsSchema.safeParse({
      ...validSettings,
      max_reactivation_window_minutes: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita exhausted_message com mais de 2000 caracteres', () => {
    const result = reactivationSettingsSchema.safeParse({
      ...validSettings,
      exhausted_message: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Maximo 2000 caracteres');
  });
});

describe('reactivationStepSchema', () => {
  const validStep = {
    wait_time_minutes: 60,
    action_type: 'send_message' as const,
  };

  it('aceita step válido com defaults', () => {
    const result = reactivationStepSchema.safeParse(validStep);
    expect(result.success).toBe(true);
  });

  it('rejeita wait_time_minutes abaixo de 1', () => {
    const result = reactivationStepSchema.safeParse({
      ...validStep,
      wait_time_minutes: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Minimo 1 minuto');
  });

  it('rejeita wait_time_minutes acima de 10080', () => {
    const result = reactivationStepSchema.safeParse({
      ...validStep,
      wait_time_minutes: 10081,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Maximo 7 dias (10080 minutos)');
  });

  it('rejeita action_type inválido', () => {
    const result = reactivationStepSchema.safeParse({
      ...validStep,
      action_type: 'invalido',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Selecione um tipo de acao valido');
  });

  it('aceita todos os action_type válidos', () => {
    for (const type of ['send_message', 'close_conversation', 'transfer_to_human']) {
      expect(reactivationStepSchema.safeParse({ ...validStep, action_type: type }).success).toBe(true);
    }
  });

  it('rejeita start_time sem end_time', () => {
    const result = reactivationStepSchema.safeParse({
      ...validStep,
      start_time: '09:00',
      end_time: '',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      'Preencha ambos os horarios ou deixe ambos em branco'
    );
  });

  it('rejeita end_time sem start_time', () => {
    const result = reactivationStepSchema.safeParse({
      ...validStep,
      start_time: '',
      end_time: '18:00',
    });
    expect(result.success).toBe(false);
  });

  it('aceita horários ambos preenchidos', () => {
    const result = reactivationStepSchema.safeParse({
      ...validStep,
      start_time: '09:00',
      end_time: '18:00',
    });
    expect(result.success).toBe(true);
  });

  it('aceita horários ambos vazios', () => {
    const result = reactivationStepSchema.safeParse({
      ...validStep,
      start_time: '',
      end_time: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita start_time com formato inválido', () => {
    const result = reactivationStepSchema.safeParse({
      ...validStep,
      start_time: '9:00',
      end_time: '18:00',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Formato invalido (use HH:MM)');
  });

  it('rejeita tag_ids com valores que não são UUID', () => {
    const result = reactivationStepSchema.safeParse({
      ...validStep,
      tag_ids: ['nao-uuid'],
    });
    expect(result.success).toBe(false);
  });

  it('aceita tag_ids com UUIDs válidos', () => {
    const result = reactivationStepSchema.safeParse({
      ...validStep,
      tag_ids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(result.success).toBe(true);
  });
});

describe('reactivationFormSchema', () => {
  const validForm = {
    settings: {
      exhausted_action: 'end_conversation',
      max_window_action: 'do_nothing',
      reactivate_when_ia_active_false: false,
    },
    steps: [
      { wait_time_minutes: 30, action_type: 'send_message' },
    ],
  };

  it('aceita formulário completo válido', () => {
    expect(reactivationFormSchema.safeParse(validForm).success).toBe(true);
  });

  it('rejeita sem steps (array vazio)', () => {
    const result = reactivationFormSchema.safeParse({ ...validForm, steps: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Adicione pelo menos 1 etapa de reativacao');
  });

  it('aceita múltiplos steps', () => {
    const result = reactivationFormSchema.safeParse({
      ...validForm,
      steps: [
        { wait_time_minutes: 30, action_type: 'send_message' },
        { wait_time_minutes: 60, action_type: 'close_conversation' },
      ],
    });
    expect(result.success).toBe(true);
  });
});
