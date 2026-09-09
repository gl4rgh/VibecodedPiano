import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/VibecodedPiano/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // On enregistre le service worker nous-mêmes via virtual:pwa-register (src/main.js), pour
      // afficher le bandeau "nouvelle version disponible" sur onNeedRefresh plutôt que de laisser
      // le plugin le faire silencieusement.
      injectRegister: false,
      workbox: {
        // Sans le worker pdf.js (pdf.worker.min-*.mjs, servi comme asset JS séparé), le rendu
        // PDF casse hors-ligne — page blanche silencieuse, aucune erreur claire. Le motif
        // *.mjs le couvre déjà.
        globPatterns: ['**/*.{js,mjs,css,html,png,svg}'],
        // Sans ça, le NavigationRoute par défaut de ce service worker (scope /VibecodedPiano/)
        // intercepte AUSSI les navigations vers /VibecodedPiano/nouvelle-ui/ (prévisualisation de
        // la refonte UI déployée à côté, voir index.html) et leur sert le index.html de ce site
        // au lieu du sien — page cassée après la première visite du site principal.
        navigateFallbackDenylist: [/\/nouvelle-ui\//],
      },
      manifest: {
        name: 'VibecodedPiano',
        short_name: 'VibecodedPiano',
        description: 'Suiveur de partition PWA : fait défiler le PDF au rythme des notes jouées sur un clavier MIDI.',
        lang: 'fr',
        start_url: '/VibecodedPiano/',
        scope: '/VibecodedPiano/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#121212',
        theme_color: '#121212',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
