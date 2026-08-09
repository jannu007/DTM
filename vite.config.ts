import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: {
        // Micro Sakura Studio（シンセ）
        main: resolve(__dirname, 'index.html'),
        // Aozora Grand Piano（グランドピアノ・/piano/ で公開）
        piano: resolve(__dirname, 'piano/index.html'),
        // Hibiki Drum Machine（ドラムマシン・/drums/ で公開）
        drums: resolve(__dirname, 'drums/index.html'),
        // Takibi Guitar（ギター・/guitar/ で公開）
        guitar: resolve(__dirname, 'guitar/index.html'),
        // Kurogane Bass（エレキベース・/bass/ で公開）
        bass: resolve(__dirname, 'bass/index.html'),
      },
    },
  },
  server: {
    port: 5174,
    host: true
  }
});
