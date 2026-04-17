import { describe, it, expect } from 'vitest';
import { upsertConversationTimeoutSchema } from '../conversation-timeout-validation';

describe('upsertConversationTimeoutSchema', () => {
  it('aceita configuração ativa com timeout', () => {
    const result = upsertConversationTimeoutSchema.safeParse({
      is_active: true,
      ia_inactive_timeout_minutes: 30,
    });
    expect(result.success).toBe(true);
  });

  it('aceita configuração inativa sem timeout', () => {
    const result = upsertConversationTimeoutSchema.safeParse({
      is_active: false,
      ia_inactive_timeout_minutes: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita is_active=true sem ia_inactive_timeout_minutes', () => {
    const result = upsertConversationTimeoutSchema.safeParse({
      is_active: true,
      ia_inactive_timeout_minutes: null,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      'Informe o tempo de inatividade para ativar o encerramento automático'
    );
    expect(result.error?.issues[0].path).toContain('ia_inactive_timeout_minutes');
  });

  it('rejeita ia_inactive_timeout_minutes negativo', () => {
    const result = upsertConversationTimeoutSchema.safeParse({
      is_active: true,
      ia_inactive_timeout_minutes: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita ia_inactive_timeout_minutes decimal', () => {
    const result = upsertConversationTimeoutSchema.safeParse({
      is_active: true,
      ia_inactive_timeout_minutes: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('aceita closure_message opcional', () => {
    const result = upsertConversationTimeoutSchema.safeParse({
      is_active: true,
      ia_inactive_timeout_minutes: 60,
      closure_message: 'Conversa encerrada por inatividade.',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita closure_message com mais de 1000 caracteres', () => {
    const result = upsertConversationTimeoutSchema.safeParse({
      is_active: false,
      closure_message: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('aceita closure_message nula', () => {
    const result = upsertConversationTimeoutSchema.safeParse({
      is_active: false,
      closure_message: null,
    });
    expect(result.success).toBe(true);
  });
});
