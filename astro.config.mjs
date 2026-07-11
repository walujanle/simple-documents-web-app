// @ts-check

import node from '@astrojs/node';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // ClientRouter enables view transitions; disable automatic link prefetch.
  // Prefetch storms hammer SSR and can return 503 under concurrent hover loads.
  prefetch: false,
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      force: true,
    },
    ssr: {
      external: ['better-sqlite3', 'pg', 'mysql2'],
    },
  },

  adapter: node({
    mode: 'standalone',
  }),
});
