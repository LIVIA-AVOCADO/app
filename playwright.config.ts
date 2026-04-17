import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  // Inicia o servidor Next.js automaticamente se não estiver rodando
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true, // reusa se já estiver rodando (dev local)
    timeout: 120_000,
  },

  fullyParallel: false, // app com Supabase real — serial para evitar rate-limit
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    // Projeto especial: faz login uma vez e salva o estado de auth
    {
      name: 'setup',
      testMatch: '**/global-setup.ts',
    },
    // Testes que precisam de autenticação
    {
      name: 'authenticated',
      testMatch: ['**/livechat.spec.ts', '**/billing.spec.ts', '**/quick-replies.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Testes públicos (login, redirects) — sem auth
    {
      name: 'public',
      testMatch: ['**/auth.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
