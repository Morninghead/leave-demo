import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { coverageConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/types/',
        '**/*.config.*',
        '**/*.d.ts',
        '**/stories/**',
        '**/.storybook/**',
        'dist/',
        'coverage/',
      ],
      include: [
        'src/**/*.{js,jsx,ts,tsx}',
        'src/**/*.{spec,test}.{js,mjs,cjs,ts,mts,cts,tsx,jsx}',
        'netlify/functions/**/*.{ts,js}',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,tsx,jsx}',
      'netlify/functions/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'src/test/',
      '**/*.stories.*',
      '**/*.config.*',
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@pages': resolve(__dirname, './src/pages'),
      '@api': resolve(__dirname, './src/api'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@contexts': resolve(__dirname, './src/contexts'),
      '@utils': resolve(__dirname, './src/utils'),
      '@types': resolve(__dirname, './src/types'),
      '@i18n': resolve(__dirname, './src/i18n'),
      '@lib': resolve(__dirname, './src/lib'),
    },
  },
  defineConfig: coverageConfig,
})