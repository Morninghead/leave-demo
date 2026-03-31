import { defineConfig, devices } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 * @see https://playwright.dev/docs/api/class-testprojectconfig
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test-only code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporter */
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'playwright-report.json' }],
    ['junit', { outputFile: 'playwright-report.xml' }],
    ['line'], // Console output
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Record trace only when testing a debug build. */
    // trace: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // dependencies: ['tests/e2e/chromium.setup.ts'],
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      // dependencies: ['tests/e2e/firefox.setup.ts'],
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      // dependencies: ['tests/e2e/webkit.setup.ts'],
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      // dependencies: ['tests/e2e/mobile.setup.ts'],
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      // dependencies: ['tests/e2e/mobile.setup.ts'],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  expect: {
    /* Timeout for expect() assertions */
    timeout: 10 * 1000,
  },
  timeout: 60 * 1000,
})