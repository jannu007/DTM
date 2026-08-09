/**
 * Micro Sakura Studio — 可視化コンポーネント
 * オシロスコープ／スペクトラム／エンベロープ／フィルター特性のリアルタイム表示。
 */
import type { Envelope, FilterParams } from '../audio/types';

function fitCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export interface ScopeHandle {
  element: HTMLElement;
  setMode(mode: 'wave' | 'spectrum'): void;
  stop(): void;
}

/** マスター出力の波形／スペクトラム表示 */
export function createScope(analyser: AnalyserNode): ScopeHandle {
  const wrap = document.createElement('div');
  wrap.className = 'scope';
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);

  let mode: 'wave' | 'spectrum' = 'wave';
  const timeData = new Float32Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  let raf = 0;
  let running = true;

  function draw() {
    if (!running) return;
    raf = requestAnimationFrame(draw);
    const ctx = fitCanvas(canvas);
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const accent = css('--accent', '#ff8ab3');
    const accent2 = css('--accent-2', '#8ad7ff');

    if (mode === 'wave') {
      analyser.getFloatTimeDomainData(timeData);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = accent;
      ctx.beginPath();
      const stepX = w / timeData.length;
      for (let i = 0; i < timeData.length; i++) {
        const y = h / 2 - timeData[i] * (h / 2) * 0.92;
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * stepX, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      analyser.getByteFrequencyData(freqData);
      const bars = 64;
      const gap = 1;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        // 対数周波数軸でビンをまとめる
        const from = Math.floor(Math.pow(i / bars, 2.2) * freqData.length);
        const to = Math.max(from + 1, Math.floor(Math.pow((i + 1) / bars, 2.2) * freqData.length));
        let sum = 0;
        for (let k = from; k < to; k++) sum += freqData[k];
        const v = sum / (to - from) / 255;
        const bh = Math.max(1, v * h);
        const grad = ctx.createLinearGradient(0, h, 0, h - bh);
        grad.addColorStop(0, accent2);
        grad.addColorStop(1, accent);
        ctx.fillStyle = grad;
        ctx.fillRect(i * bw, h - bh, bw - gap, bh);
      }
    }
  }
  draw();

  return {
    element: wrap,
    setMode(m) {
      mode = m;
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}

/** ADSR エンベロープの形をグラフ表示 */
export function createEnvelopeView(getEnv: () => Envelope): { element: HTMLElement; update: () => void } {
  const canvas = document.createElement('canvas');
  canvas.className = 'graph graph-env';

  function update() {
    const ctx = fitCanvas(canvas);
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const pad = 4;
    ctx.clearRect(0, 0, w, h);
    const env = getEnv();
    const total = Math.max(0.35, env.attack + env.decay + 0.5 + env.release);
    const x = (t: number) => pad + (t / total) * (w - pad * 2);
    const y = (v: number) => h - pad - v * (h - pad * 2);

    const aX = x(env.attack);
    const dX = x(env.attack + env.decay);
    const sX = x(env.attack + env.decay + 0.5);
    const rX = x(total);

    ctx.strokeStyle = css('--grid', 'rgba(255,255,255,0.08)');
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(pad, (h / 4) * i);
      ctx.lineTo(w - pad, (h / 4) * i);
      ctx.stroke();
    }

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, css('--accent', '#ff8ab3') + '55');
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.moveTo(x(0), y(0));
    ctx.lineTo(aX, y(1));
    ctx.lineTo(dX, y(env.sustain));
    ctx.lineTo(sX, y(env.sustain));
    ctx.lineTo(rX, y(0));
    ctx.strokeStyle = css('--accent', '#ff8ab3');
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineTo(x(0), y(0));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  requestAnimationFrame(update);
  return { element: canvas, update };
}

/** フィルターの周波数特性を表示 */
export function createFilterView(getFilter: () => FilterParams): { element: HTMLElement; update: () => void } {
  const canvas = document.createElement('canvas');
  canvas.className = 'graph graph-filter';

  function response(f: FilterParams, freq: number): number {
    const ratio = freq / Math.max(20, f.cutoff);
    const order = f.slope === 24 ? 4 : 2;
    const q = 0.5 + f.resonance * 12;
    let mag: number;
    switch (f.type) {
      case 'highpass':
        mag = Math.pow(ratio, order) / Math.sqrt(1 + Math.pow(ratio, 2 * order));
        break;
      case 'bandpass':
        mag = 1 / Math.sqrt(1 + Math.pow(q * (ratio - 1 / ratio), 2));
        break;
      case 'notch':
        mag = Math.abs(ratio - 1 / ratio) / Math.sqrt(Math.pow(ratio - 1 / ratio, 2) + 1 / (q * q));
        break;
      default:
        mag = 1 / Math.sqrt(1 + Math.pow(ratio, 2 * order));
        break;
    }
    // レゾナンスによるピーク
    if (f.type !== 'notch') {
      const peak = f.resonance * 2.2;
      mag *= 1 + peak * Math.exp(-Math.pow(Math.log(ratio) * 2.4, 2));
    }
    return mag;
  }

  function update() {
    const ctx = fitCanvas(canvas);
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);
    const f = getFilter();
    const minF = 20;
    const maxF = 20000;

    ctx.strokeStyle = css('--grid', 'rgba(255,255,255,0.08)');
    ctx.lineWidth = 1;
    for (const mark of [100, 1000, 10000]) {
      const x = (Math.log(mark / minF) / Math.log(maxF / minF)) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const n = i / 160;
      const freq = minF * Math.pow(maxF / minF, n);
      const db = 20 * Math.log10(Math.max(1e-4, response(f, freq)));
      const y = h - ((db + 48) / 60) * h;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(n * w, y);
    }
    ctx.strokeStyle = css('--accent-2', '#8ad7ff');
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, css('--accent-2', '#8ad7ff') + '44');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fill();

    // カットオフ位置
    const cx = (Math.log(Math.max(minF, f.cutoff) / minF) / Math.log(maxF / minF)) * w;
    ctx.strokeStyle = css('--accent', '#ff8ab3');
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  requestAnimationFrame(update);
  return { element: canvas, update };
}

/** 縦型レベルメーター */
export function createMeter(): { element: HTMLElement; set: (peak: number) => void } {
  const wrap = document.createElement('div');
  wrap.className = 'meter';
  const bar = document.createElement('div');
  bar.className = 'meter-bar';
  wrap.appendChild(bar);
  let shown = 0;
  return {
    element: wrap,
    set(peak: number) {
      const db = 20 * Math.log10(Math.max(1e-4, peak));
      const norm = Math.max(0, Math.min(1, (db + 54) / 54));
      shown = norm > shown ? norm : shown * 0.82 + norm * 0.18;
      bar.style.height = `${(shown * 100).toFixed(1)}%`;
      bar.classList.toggle('hot', peak > 0.94);
    },
  };
}

/** 横型レベルメーター（ミキサー用） */
export function createMeterRow(): { element: HTMLElement; set: (peak: number) => void } {
  const wrap = document.createElement('div');
  wrap.className = 'meter-row';
  const bar = document.createElement('div');
  bar.className = 'meter-row-bar';
  wrap.appendChild(bar);
  let shown = 0;
  return {
    element: wrap,
    set(peak: number) {
      const db = 20 * Math.log10(Math.max(1e-4, peak));
      const norm = Math.max(0, Math.min(1, (db + 54) / 54));
      shown = norm > shown ? norm : shown * 0.8 + norm * 0.2;
      bar.style.width = `${(shown * 100).toFixed(1)}%`;
      bar.classList.toggle('hot', peak > 0.94);
    },
  };
}
