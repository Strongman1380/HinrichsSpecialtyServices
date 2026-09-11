import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

process.env.CRM_WORKFLOW_BASE_PATH = '';

// Run only with local Firestore/Auth emulators; all remote browser requests are blocked by the spec.
export default defineConfig({
  testDir: './e2e', testMatch: ['finance-repairs.spec.js', 'crm-workflows.spec.js'], workers: 1,
  reporter: 'list', outputDir: '/tmp/hsst-finance-browser-results',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4187', screenshot: 'only-on-failure' },
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4187 --strictPort`,
    cwd: fileURLToPath(new URL('../HSP CRM', import.meta.url)),
    env: { VITE_USE_EMULATORS: 'true' }, url: 'http://127.0.0.1:4187', reuseExistingServer: false,
  },
});
