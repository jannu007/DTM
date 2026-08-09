import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    // AudioWorklet のスクリプトは data: URL に埋め込まれると addModule() に失敗する
    // 環境があるため、必ず独立したファイルとして出力する
    assetsInlineLimit: (filePath: string) => (/worklets?[\\/].*\.js$|-processor\.js$/.test(filePath) ? false : undefined),
    rollupOptions: {
      input: {
        // Micro Sakura Studio（シンセ）
        main: resolve(__dirname, 'index.html'),
        // Aozora Grand Piano（グランドピアノ・/piano/ で公開）
        piano: resolve(__dirname, 'piano/index.html'),
      },
    },
  },
  server: {
    port: 5174,
    host: true
  }
});
