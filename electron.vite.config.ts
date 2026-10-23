import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const developmentNonce = randomBytes(18).toString('base64');

export default defineConfig({
  main: { build: { rollupOptions: { input: resolve('electron/main.ts'), output: { entryFileNames: 'index.js' } } } },
  preload: {
    build: {
      rollupOptions: {
        input: resolve('electron/preload.ts'),
        output: { format: 'cjs', entryFileNames: 'index.cjs' },
      },
    },
  },
  renderer: {
    root: 'frontend',
    html: { cspNonce: developmentNonce },
    plugins: [react(), {
      name: 'village-development-csp',
      transformIndexHtml(html, context) {
        // Only the local dev server needs React Refresh's inline bootstrap.
        // A fresh per-server nonce authorizes it; production retains script-src 'self'.
        return context.server ? html.replace("script-src 'self'", `script-src 'self' 'nonce-${developmentNonce}'`) : html;
      },
    }],
    build: { rollupOptions: { input: resolve('frontend/index.html') } },
    server: { host: '127.0.0.1' },
  },
});
