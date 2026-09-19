import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

function envBase(): string {
  const env = (globalThis as { process?: { env?: { BASE_PATH?: string } } }).process
    ?.env;
  const value = env?.BASE_PATH;
  return typeof value === 'string' && value.length > 0 ? value : '/';
}

export default defineConfig(({ mode }) => {
  const isTest = mode === 'test';
  return {
    base: envBase(),
    plugins: [
      react(),
      VitePWA({
        disable: isTest,
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'icon-192.png',
          'icon-512.png',
          'apple-touch-icon.png',
        ],
        manifest: {
          name: 'PLO Pot Trainer',
          short_name: 'PLO Trainer',
          description: 'PLO ポット計算の練習',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: './',
          scope: './',
          lang: 'ja',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
        devOptions: {
          enabled: !isTest,
        },
      }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  };
});
