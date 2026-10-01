import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable + offline-capable. Skipped under Vitest (no service worker needed there).
    !process.env.VITEST &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'PIG — Roll. Risk. Win.',
          short_name: 'PIG',
          description: 'A fast local-multiplayer dice game. Roll, risk, bank — first to the target score wins.',
          theme_color: '#58CC02',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Precache the whole app shell, including the bundled fonts, so it works offline.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        },
      }),
  ],
  server: { port: 5173 },
  preview: { port: 4173 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    css: false,
    restoreMocks: true,
  },
});
