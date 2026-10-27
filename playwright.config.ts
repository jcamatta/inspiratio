import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'

/** E2E runs against an isolated library so it never touches the user's references. */
export const E2E_DATA_DIR = resolve(import.meta.dirname, '.e2e-data')
export const E2E_API_PORT = 4329
export const E2E_WEB_PORT = 5329
export const E2E_API_URL = `http://127.0.0.1:${String(E2E_API_PORT)}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${String(E2E_WEB_PORT)}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: 'npx tsx apps/server/src/main.ts',
      url: `${E2E_API_URL}/api/health`,
      reuseExistingServer: false,
      env: {
        INSPIRATIO_DATA_DIR: E2E_DATA_DIR,
        INSPIRATIO_PORT: String(E2E_API_PORT),
        INSPIRATIO_LOG_FORMAT: 'json',
        INSPIRATIO_AGENT: 'off',
      },
    },
    {
      command: 'npm run dev -w @inspiratio/web',
      url: `http://localhost:${String(E2E_WEB_PORT)}`,
      reuseExistingServer: false,
      env: { INSPIRATIO_API_URL: E2E_API_URL, INSPIRATIO_WEB_PORT: String(E2E_WEB_PORT) },
    },
  ],
})
