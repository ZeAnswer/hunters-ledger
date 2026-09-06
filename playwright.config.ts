import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5173', ...devices['Pixel 7'] },
  webServer: { command: 'npm run dev -w packages/app -- --port 5173', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
});
