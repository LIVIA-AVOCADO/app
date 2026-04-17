/**
 * billing.spec.ts — Fluxos de Faturamento/Financeiro
 *
 * Requer autenticação (projeto "authenticated").
 */
import { test, expect } from '@playwright/test';

test.describe('Financeiro — usuário autenticado', () => {
  test('carrega a página de saldo sem erros', async ({ page }) => {
    await page.goto('/financeiro/saldo');
    await expect(page).toHaveURL(/\/financeiro\/saldo/);
    await expect(page.locator('body')).not.toContainText('Unexpected error', { timeout: 10_000 });
  });

  test('exibe card de saldo ou seção de créditos', async ({ page }) => {
    await page.goto('/financeiro/saldo');

    const walletSection = page
      .getByText(/crédito/i)
      .or(page.getByText(/saldo/i))
      .or(page.getByText(/R\$/))
      .first();

    await expect(walletSection).toBeVisible({ timeout: 15_000 });
  });

  test('exibe card de assinatura com status', async ({ page }) => {
    await page.goto('/financeiro/saldo');

    // SubscriptionStatusCard sempre exibe "Manutenção Mensal"
    const subscriptionCard = page.getByText(/manutenção mensal/i);
    await expect(subscriptionCard).toBeVisible({ timeout: 15_000 });
  });

  test('API de wallet retorna 400 sem tenantId', async ({ page }) => {
    const response = await page.request.get('/api/billing/wallet');
    expect(response.status()).toBe(400);
  });

  test('API de wallet retorna 401 sem autenticação', async ({ browser }) => {
    // Contexto sem autenticação
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await page.request.get('/api/billing/wallet?tenantId=qualquer');
    expect(response.status()).toBe(401);

    await context.close();
  });
});
