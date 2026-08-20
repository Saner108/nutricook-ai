import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Library build for src/design-system — the NutriCook AI component set,
// bundled separately from the app so it can sync to claude.ai/design.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-ds',
    emptyOutDir: true,
    lib: {
      entry: 'src/design-system/index.js',
      formats: ['es'],
      fileName: () => 'index.es.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
});
