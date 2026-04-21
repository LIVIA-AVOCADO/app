/**
 * auth.spec.ts — Fluxos de autenticação
 *
 * Testa: página de login, redirecionamentos, validação de formulário.
 * Não requer usuário autenticado — usa o projeto "public".
 */
import { test, expect } from '@playwright/test';

// Estes testes não requerem autenticação
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Página de Login', () => {
  test('exibe formulário com campos de email e senha', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('exibe link para cadastro', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: /cadastre-se/i })).toBeVisible();
  });

  test('exibe erro com credenciais inválidas', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('invalido@teste.com');
    await page.getByLabel('Senha').fill('senhaerrada123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Deve aparecer mensagem de erro sem redirecionar
    await expect(page.getByRole('alert').or(page.locator('[class*="destructive"]'))).toBeVisible({
      timeout: 8_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  test('botão fica desabilitado durante o envio', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('teste@exemplo.com');
    await page.getByLabel('Senha').fill('senha123');

    // Intercepta a requisição para deixá-la pendente
    await page.route('**/auth/v1/token**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      await route.abort();
    });

    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('button', { name: /entrando/i })).toBeDisabled();
  });
});

test.describe('Redirecionamentos não autenticados', () => {
  test('redireciona /inbox → /login quando não autenticado', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test('redireciona /financeiro/saldo → /login quando não autenticado', async ({ page }) => {
    await page.goto('/financeiro/saldo');
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test('redireciona /configuracoes → /login quando não autenticado', async ({ page }) => {
    await page.goto('/configuracoes');
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });
});
