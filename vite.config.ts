import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * GitHub Pages serves the site under /<repo>/, but the Capacitor shell loads the
 * same bundle from the WebView root. The Pages workflow sets VITE_BASE; every
 * other build (dev, `npm run ios:sync`) stays at "/".
 */
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "favicon.png"],
      manifest: {
        name: "ContextTask — LifeQuest",
        short_name: "ContextTask",
        description: "文脈で捉えるタスクキャプチャ",
        lang: "ja",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#08080f",
        theme_color: "#08080f",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The whole app is precached: a capture must work with no network at all.
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        // The token typography comes from Google Fonts, which precache cannot
        // reach (cross-origin). Cache it on first load so the Deep Mist tone
        // survives offline instead of falling back to a system face.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "lifequest-fonts",
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5183 },
  build: { outDir: "dist" },
});
