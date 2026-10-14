import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { createTvCatalog, tvTranslationMacro } from './scripts/tv-localization.mjs';

const root = import.meta.dirname;
const testReact = path.resolve(root, '../../node_modules');
const catalog = createTvCatalog();

export default defineConfig({
  root,
  define: { __TV_CATALOG__: JSON.stringify(catalog) },
  plugins: [react({babel:{plugins:[tvTranslationMacro(catalog)]}})],
  // Vitest's Vite 8 uses Oxc; the production TV workflow still uses Vite 7.
  oxc: {jsx:{runtime:'automatic',importSource:'react'}},
  resolve: {
    alias: [
      {find:'@',replacement:path.resolve(root,'src')},
      {find:'@assets',replacement:path.resolve(root,'../../attached_assets')},
      {find:/^react$/,replacement:path.resolve(testReact,'react/index.js')},
      {find:/^react\/jsx-runtime$/,replacement:path.resolve(testReact,'react/jsx-runtime.js')},
      {find:/^react\/jsx-dev-runtime$/,replacement:path.resolve(testReact,'react/jsx-dev-runtime.js')},
      {find:/^react-dom$/,replacement:path.resolve(testReact,'react-dom/index.js')},
      {find:/^react-dom\/client$/,replacement:path.resolve(testReact,'react-dom/client.js')},
    ],
    dedupe:['react','react-dom'],
  },
  test: {include:['src/**/*.test.{ts,tsx}'],environment:'node'},
});
