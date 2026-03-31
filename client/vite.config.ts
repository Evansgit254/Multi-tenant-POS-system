import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-*.png'],
      manifest: {
        name: 'ServePoint POS',
        short_name: 'ServePoint',
        description: 'Premier Hotel Point of Sale System',
        theme_color: '#b8860b',
        background_color: '#0f0f13',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache API menu calls so POS works offline
            urlPattern: /\/api\/tenants\/.*\/menu\/(items|categories)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'menu-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 4 }, // 4 hours
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Cache auth/tenant config
            urlPattern: /\/api\/auth\/me/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'auth-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 30 }, // 30 min
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Cache static assets aggressively
            urlPattern: /\.(js|css|png|jpg|woff2|svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 } // 1 week
            }
          }
        ]
      }
    })
  ]
});
