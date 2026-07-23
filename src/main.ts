import { App } from './ui/App';

const root = document.getElementById('app');
if (root) {
  new App(root);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // オフライン対応は必須機能ではないため、登録失敗時は無視する
    });
  });
}
