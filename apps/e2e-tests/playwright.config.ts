import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4200',
    // CDP only works with Chromium-based browsers
    browserName: 'chromium',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npx nx serve sandbox',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    cwd: '../..',
  },
});
