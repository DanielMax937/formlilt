import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: process.env.PLAYWRIGHT_BASE_URL ? 30000 : 5000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3050',
    trace: 'retain-on-failure',
    proxy: process.env.PLAYWRIGHT_PROXY ? { server: process.env.PLAYWRIGHT_PROXY } : undefined,
    launchOptions: process.env.PLAYWRIGHT_DISABLE_HTTP2 ? { args: ['--disable-http2'] } : undefined,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://127.0.0.1:3050',
        reuseExistingServer: true,
        timeout: 120000,
      },
});
