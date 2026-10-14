import { createReadStream, readFileSync, statSync } from 'node:fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';
import { createTvCatalog, tvTranslationMacro } from './scripts/tv-localization.mjs';

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
const tvCatalog = createTvCatalog();
const webosPackage = process.env.TV_PACKAGE === 'webos';
const webosInfo = JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'webos/appinfo.json'), 'utf8')) as { id: string; version: string };
const packageName = `${webosInfo.id}_${webosInfo.version}_all.ipk`;
const packageFile = path.resolve(import.meta.dirname, 'dist', packageName);
const zipName = `${webosInfo.id}_${webosInfo.version}_all.zip`;
const zipFile = path.resolve(import.meta.dirname, 'dist', zipName);

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  define: { __TV_CATALOG__: JSON.stringify(tvCatalog) },
  plugins: [
    {
      name: 'tv-test-package-download',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const requested = req.url?.split('?')[0];
          const download = requested === `/tv/download/${packageName}`
            ? { name: packageName, file: packageFile, type: 'application/octet-stream' }
            : requested === `/tv/download/${zipName}`
              ? { name: zipName, file: zipFile, type: 'application/zip' }
              : null;
          if (!download) return next();
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.statusCode = 405;
            res.end('Method not allowed');
            return;
          }
          try {
            const size = statSync(download.file).size;
            res.setHeader('Content-Type', download.type);
            res.setHeader('Content-Disposition', `attachment; filename="${download.name}"`);
            res.setHeader('Content-Length', size);
            res.setHeader('Cache-Control', 'no-store');
            if (req.method === 'HEAD') {
              res.end();
            } else {
              createReadStream(download.file).on('error', () => res.destroy()).pipe(res);
            }
          } catch {
            res.statusCode = 404;
            res.end('TV test package not found');
          }
        });
      },
    },
    react({ babel: { plugins: [tvTranslationMacro(tvCatalog)] } }),
    tailwindcss(),
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
    // webOS 5.0 uses Chromium 68. A packaged file:// app must also use a
    // classic script instead of an ES module, which is rejected locally.
    ...(webosPackage ? {
      target: 'chrome68',
      cssTarget: 'chrome68',
      rollupOptions: { output: { format: 'iife' as const, inlineDynamicImports: true } },
    } : {}),
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/tv/source-assets': {
        target: 'http://127.0.0.1:20042',
        changeOrigin: true,
        rewrite: (url) => url.replace(/^\/tv\/source-assets/, ''),
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
