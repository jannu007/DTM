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
        // Hoshizora Vocal（日本語歌声シンセ・/vocal/ で公開）
        vocal: resolve(__dirname, 'vocal/index.html'),
      },
    },
  },
  server: {
    port: 5174,
    host: true
  }
});
