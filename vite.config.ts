import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base relativa para funcionar no GitHub Pages (/seila/)
export default defineConfig({
  plugins: [
    react(),
    // App instalável (PWA): manifesto + service worker com cache offline
    VitePWA({
      registerType: 'prompt', // nova versão só entra quando o jogador aceitar (não interrompe partidas)
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-64.png'],
      manifest: {
        name: 'Residuelo — Duelo de Residência Médica',
        short_name: 'Residuelo',
        description: 'Questões reais de residência médica em duelos estilo Perguntados.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0a1f',
        theme_color: '#0b0a1f',
        categories: ['education', 'games', 'medical'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // app + banco de questões + imagens das questões ficam disponíveis offline
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}', 'banco/*.json', 'banco/img/*.jpg'],
        globIgnores: ['banco/orig/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // recortes originais das provas (~20 MB): guardados conforme são abertos
            urlPattern: ({ url }) => url.pathname.includes('/banco/orig/'),
            handler: 'CacheFirst',
            options: { cacheName: 'questoes-originais', expiration: { maxEntries: 800 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/online-config.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'config' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fontes' },
          },
        ],
      },
    }),
  ],
  base: './',
});
