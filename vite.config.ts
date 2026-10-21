import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { reportsPlugin } from './scripts/reports-plugin';

export default defineConfig({
  plugins: [react(), reportsPlugin()],
  worker: { format: 'es' },
  // These are only imported lazily (scan worker, export buttons); pre-bundle them so first use doesn't trigger a dev reload.
  optimizeDeps: { include: ['jszip', 'pptxgenjs', 'jspdf'] },
  server: {
    // Decompiled sources can be tens of thousands of files; the viewer never needs to watch them.
    watch: { ignored: ['**/work/**', '**/apks/**', '**/test/out/**'] },
  },
  build: {
    rollupOptions: {
      input: {
        landing: 'index.html', // the public website
        app: 'app.html',       // the report viewer (also the live demo)
      },
    },
  },
});
