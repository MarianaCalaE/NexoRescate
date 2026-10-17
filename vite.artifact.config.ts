// Compilación en un solo archivo HTML para publicar una demo navegable (sin servidor).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  define: { 'import.meta.env.VITE_SINGLEFILE': JSON.stringify('1') },
  build: { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 5000 },
});
