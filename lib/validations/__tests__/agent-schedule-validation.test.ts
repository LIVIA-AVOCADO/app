import { describe, it, expect } from 'vitest';
import { weeklyIntervalSchema, exceptionSchema } from '../agent-schedule-validation';

describe('weeklyIntervalSchema', () => {
  const validInterval = {
    day_of_week: 1,
    start_time: '09:00',
    end_time: '18:00',
    is_active: true,
  };

  it('aceita intervalo válido', () => {
    expect(weeklyIntervalSchema.safeParse(validInterval).success).toBe(true);
  });

  it('aceita day_of_week de 0 a 6', () => {
    for (let day = 0; day <= 6; day++) {
      const result = weeklyIntervalSchema.safeParse({ ...validInterval, day_of_week: day });
      expect(result.success).toBe(true);
    }
  });

  it('rejeita day_of_week negativo', () => {
    const result = weeklyIntervalSchema.safeParse({ ...validInterval, day_of_week: -1 });
    expect(result.success).toBe(false);
  });

  it('rejeita day_of_week maior que 6', () => {
    const result = weeklyIntervalSchema.safeParse({ ...validInterval, day_of_week: 7 });
    expect(result.success).toBe(false);
  });

  it('rejeita start_time com formato inválido', () => {
    const result = weeklyIntervalSchema.safeParse({ ...validInterval, start_time: '9:00' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Formato inválido — use HH:MM');
  });

  it('rejeita end_time com formato inválido', () => {
    const result = weeklyIntervalSchema.safeParse({ ...validInterval, end_time: '1800' });
    expect(result.success).toBe(false);
  });

  it('rejeita end_time menor ou igual ao start_time', () => {
    const result = weeklyIntervalSchema.safeParse({
      ...validInterval,
      start_time: '18:00',
      end_time: '09:00',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      'O horário de fim deve ser posterior ao de início'
    );
  });

  it('rejeita end_time igual ao start_time', () => {
    const result = weeklyIntervalSchema.safeParse({
      ...validInterval,
      start_time: '09:00',
      end_time: '09:00',
    });
    expect(result.success).toBe(false);
  });

  it('aceita id UUID opcional', () => {
    const result = weeklyIntervalSchema.safeParse({
      ...validInterval,
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita id que não é UUID', () => {
    const result = weeklyIntervalSchema.safeParse({ ...validInterval, id: 'nao-uuid' });
    expect(result.success).toBe(false);
  });

  it('aceita offline_message nula', () => {
    const result = weeklyIntervalSchema.safeParse({ ...validInterval, offline_message: null });
    expect(result.success).toBe(true);
  });

  it('rejeita offline_message com mais de 500 caracteres', () => {
    const result = weeklyIntervalSchema.safeParse({
      ...validInterval,
      offline_message: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('exceptionSchema', () => {
  it('aceita exceção do tipo blocked sem horários', () => {
    const result = exceptionSchema.safeParse({
      exception_date: '2026-12-25',
      type: 'blocked',
    });
    expect(result.success).toBe(true);
  });

  it('aceita exceção do tipo custom com horários válidos', () => {
    const result = exceptionSchema.safeParse({
      exception_date: '2026-12-25',
      type: 'custom',
      start_time: '10:00',
      end_time: '14:00',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita exception_date com formato inválido', () => {
    const result = exceptionSchema.safeParse({
      exception_date: '25/12/2026',
      type: 'blocked',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Data inválida — use YYYY-MM-DD');
  });

  it('rejeita type inválido', () => {
    const result = exceptionSchema.safeParse({
      exception_date: '2026-12-25',
      type: 'invalido',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita custom sem horários', () => {
    const result = exceptionSchema.safeParse({
      exception_date: '2026-12-25',
      type: 'custom',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      'Informe os horários para o tipo personalizado'
    );
  });

  it('rejeita custom com end_time menor que start_time', () => {
    const result = exceptionSchema.safeParse({
      exception_date: '2026-12-25',
      type: 'custom',
      start_time: '18:00',
      end_time: '10:00',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      'O horário de fim deve ser posterior ao de início'
    );
  });

  it('aceita label opcional', () => {
    const result = exceptionSchema.safeParse({
      exception_date: '2026-12-25',
      type: 'blocked',
      label: 'Natal',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita label com mais de 100 caracteres', () => {
    const result = exceptionSchema.safeParse({
      exception_date: '2026-12-25',
      type: 'blocked',
      label: 'x'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});
