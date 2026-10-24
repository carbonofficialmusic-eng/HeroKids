import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;
const webBuild = { id: new Date().toISOString(), diagnostics: "phone-layout-1" };

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig(async ({ mode }) => {
  const bundledDevelopment = mode === 'preview-development';
  let previewBuild = String(Date.now());
  return {
  base: basePath,
  define: {
    'import.meta.env.VITE_LC_WEB_BUILD': JSON.stringify(webBuild.id),
    ...(bundledDevelopment ? {
      'import.meta.env.DEV': 'true',
      'import.meta.env.PROD': 'false',
    } : {}),
  },
  plugins: [
    {
      name: 'little-champs-build-info',
      buildStart() {
        previewBuild = String(Date.now());
      },
      transformIndexHtml() {
        return [
          { tag: 'meta', attrs: { name: 'lc-web-build', content: webBuild.id }, injectTo: 'head' as const },
          ...(bundledDevelopment ? [
            { tag: 'meta', attrs: { name: 'lc-preview-build', content: previewBuild, 'data-check-url': `${basePath}preview-build.json` }, injectTo: 'head' as const },
            { tag: 'script', attrs: { src: `${basePath}preview-refresh.js`, defer: true }, injectTo: 'body' as const },
          ] : []),
        ];
      },
      configureServer(server) {
        server.middlewares.use(`${basePath}build-info.json`, (_request, response) => {
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify(webBuild));
        });
      },
      generateBundle() {
        if (bundledDevelopment) {
          this.emitFile({
            type: 'asset',
            fileName: 'preview-build-pending.json',
            source: JSON.stringify({ id: previewBuild }),
          });
        }
        this.emitFile({
          type: 'asset',
          fileName: 'build-info.json',
          source: JSON.stringify(webBuild),
        });
      },
    },
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@shared': path.resolve(import.meta.dirname, '..', '..', 'lib', 'legacy-shared', 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    warmup: {
      clientFiles: ['./src/main.tsx', './src/pages/dashboard.tsx'],
    },
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: false,
    },
  },
  preview: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  };
});
