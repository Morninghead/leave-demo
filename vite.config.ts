import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const localFunctionsProxyTarget =
  process.env.NETLIFY_DEV_URL ||
  process.env.VITE_NETLIFY_DEV_URL ||
  'http://localhost:8896'

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    react(),
    ...(command === 'build'
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['company-icon.svg'],
            // ✅ FIX: Disable navigation fallback to prevent precache error for SPA
            workbox: {
              navigateFallback: null,
              skipWaiting: true,
              clientsClaim: true,
            },
            manifest: {
              name: 'SSTH Leave Management System',
              short_name: 'SSTH Leave',
              description: 'HR Leave Management System for Shin Shin Thailand',
              theme_color: '#2563eb',
              background_color: '#ffffff',
              display: 'standalone',
              orientation: 'any',
              start_url: '/dashboard',
              scope: '/',
              icons: [
                {
                  src: '/company-icon.svg',
                  sizes: 'any',
                  type: 'image/svg+xml',
                  purpose: 'any maskable'
                }
              ]
            }
          }),
        ]
      : [])
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@api': path.resolve(__dirname, './src/api'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@i18n': path.resolve(__dirname, './src/i18n'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/.netlify/functions': {
        target: localFunctionsProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for large libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['lucide-react', 'clsx', 'react-hot-toast'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-date': ['date-fns', 'react-datepicker'],
          'vendor-charts': ['recharts'],
          'vendor-export': ['xlsx', 'jspdf', 'jspdf-autotable', 'html2canvas'],
          'vendor-auth': ['@supabase/supabase-js', 'jsonwebtoken', 'bcryptjs'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-utils': ['axios', 'uuid'],
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/[name]-[hash].js`;
        },
      },
    },
    target: 'esnext',
    minify: 'terser',
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'lucide-react',
      'date-fns',
      'clsx',
    ],
  },
}))
