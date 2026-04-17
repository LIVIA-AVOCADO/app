/**
 * global-setup.ts
 *
 * Autentica uma vez com Supabase e salva o estado em e2e/.auth/user.json.
 * Todos os testes no projeto "authenticated" reutilizam esse estado.
 *
 * Requer variáveis de ambiente:
 *   E2E_USER_EMAIL    — e-mail de um usuário de teste válido
 *   E2E_USER_PASSWORD — senha do usuário
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

setup('autenticar usuário de teste', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL e E2E_USER_PASSWORD precisam estar definidos para os testes E2E autenticados.'
    );
  }

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();

  // Aguarda redirect para livechat após login bem-sucedido
  await page.waitForURL('**/livechat', { timeout: 15_000 });
  await expect(page).toHaveURL(/\/livechat/);

  await page.context().storageState({ path: AUTH_FILE });
});
