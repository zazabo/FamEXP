import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// GitHub Pages serves a project site from /<repo>/. Set VITE_BASE=/<repo>/ at build time (the deploy workflow does it).
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      output: {
        // Framework code in its own long-lived chunks: an app update re-downloads only the app code.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 3 },
            { name: 'vendor-router', test: /node_modules[\\/](react-router|react-router-dom|cookie|set-cookie-parser)[\\/]/, priority: 2 },
            { name: 'vendor-data', test: /node_modules[\\/](dexie|dexie-react-hooks|i18next|react-i18next|html-parse-stringify|void-elements)[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.png'],
      manifest: {
        name: 'Οικογενειακό Εξοδολόγιο',
        short_name: 'Εξοδολόγιο',
        description: 'Γρήγορη καταγραφή οικογενειακών εξόδων για γονείς.',
        lang: 'el',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        theme_color: '#F7F7F5',
        background_color: '#F7F7F5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,ttf}'],
        navigateFallback: 'index.html',
        // jsPDF's optional helpers (HTML/SVG rendering) are never used by the report; don't precache them.
        globIgnores: ['**/html2canvas-*.js', '**/purify.es-*.js', '**/index.es-*.js'],
      },
    }),
  ],
});
