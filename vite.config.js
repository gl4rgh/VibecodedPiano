import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';

// Sous-chemin de déploiement : /VibecodedPiano/ pour le site principal (GitHub Pages depuis
// main), surchargeable via VITE_DEPLOY_BASE pour builder une prévisualisation sous un
// sous-chemin (ex. /VibecodedPiano/nouvelle-ui/, voir .github/workflows/deploy.yml).
const deployBase = process.env.VITE_DEPLOY_BASE || '/VibecodedPiano/';

export default defineConfig({
  base: deployBase,
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
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,woff2}'],
      },
      manifest: {
        name: 'VibecodedPiano',
        short_name: 'VibecodedPiano',
        description: 'Suiveur de partition PWA : fait défiler le PDF au rythme des notes jouées sur un clavier MIDI.',
        lang: 'fr',
        start_url: deployBase,
        scope: deployBase,
        display: 'standalone',
        orientation: 'any',
        // Palette Nocturne (refonte cosmétique) — cohérence avec base.css --color-bg/--color-accent.
        background_color: '#161826',
        theme_color: '#161826',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
