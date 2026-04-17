/**
 * quick-replies.spec.ts — Fluxos de Respostas Rápidas
 *
 * Requer autenticação (projeto "authenticated").
 * A página de respostas rápidas fica em /configuracoes ou em modal no livechat.
 */
import { test, expect } from '@playwright/test';

test.describe('Quick Replies — usuário autenticado', () => {
  test('carrega a lista de respostas rápidas', async ({ page }) => {
    // Acessa via API diretamente para confirmar que a rota está funcional
    const response = await page.request.get('/api/quick-replies', {
      params: { tenantId: 'any' }, // será rejeitado com 401 se sessão inválida, 403 se tenant não bate
    });

    // 401 não esperado (usuário está autenticado), deve ser 400 (falta tenantId correto) ou 403
    expect(response.status()).not.toBe(401);
  });

  test('API retorna 400 quando tenantId ausente', async ({ page }) => {
    const response = await page.request.get('/api/quick-replies');
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('tenantId');
  });

  test('API retorna 400 para campos obrigatórios ausentes no POST', async ({ page }) => {
    const response = await page.request.post('/api/quick-replies', {
      data: { title: 'Olá' }, // sem content e tenantId
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);
  });
});
