import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4175',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {},
  },
  workers: 1,
  webServer: [
    { command: 'node --import tsx tests/e2e-server.ts', url: 'http://localhost:4175/api/health', env: { NODE_ENV: 'test' }, reuseExistingServer: false, timeout: 60000 },
  ],
})
