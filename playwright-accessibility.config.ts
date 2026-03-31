import { defineConfig, devices } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

export default defineConfig({
  testDir: './tests/accessibility',
  fullyParallel: false, // Accessibility tests are sequential
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'accessibility-report.json' }],
    ['junit', { outputFile: 'accessibility-report.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'accessibility',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['tests/accessibility/setup.ts'],
      testMatch: '**/*.accessibility.spec.ts',
      expect: {
        timeout: 30 * 1000, // Accessibility tests may take longer
      },
      tests: [
        // Add specific accessibility tests here
        'login/accessibility.spec.ts',
        'dashboard/accessibility.spec.ts',
        'leave-request/accessibility.spec.ts',
        'employee-management/accessibility.spec.ts',
        'reports/accessibility.spec.ts',
      ],
    },
  ],
})