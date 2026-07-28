import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '.vite/renderer/main_window'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
