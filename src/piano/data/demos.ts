import type { PerformanceEvent } from '../audio/types';

export interface Demo {
  id: string;
  title: string;
  composer: string;
  note: string;
  presetId: string;
  build: () => PerformanceEvent[];
}

/** 再現性のある微小な揺らぎ（毎回同じ演奏になるよう固定シード） */
function humanizer(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

class Take {
  events: PerformanceEvent[] = [];
  private rand: () => number;

  constructor(seed: number) {
    this.rand = humanizer(seed);
  }

  note(time: number, note: number, duration: number, vel: number, spread = 0.012) {
    const jitter = (this.rand() - 0.5) * spread;
    const start = Math.max(0, time + jitter);
    const v = Math.max(0.05, Math.min(1, vel + (this.rand() - 0.5) * 0.08));
    this.events.push({ time: start, type: 'note', note, vel: v });
    this.events.push({ time: start + Math.max(0.05, duration), type: 'off', note });
  }

  pedal(time: number, value: number) {
    this.events.push({ time: Math.max(0, time), type: 'sustain', value });
  }

  /** 1小節ごとにペダルを踏み替える（直前で上げ、直後に踏み直す） */
  pedalPerBar(barStart: number) {
    if (barStart > 0.05) this.pedal(barStart - 0.02, 0);
    this.pedal(barStart + 0.06, 1);
  }

  done(): PerformanceEvent[] {
    return this.events.sort((a, b) => a.time - b.time);
  }
}

// ---------------------------------------------------------------------------
// J.S. Bach : 平均律クラヴィーア曲集 第1巻 前奏曲 第1番 ハ長調 BWV 846（パブリックドメイン）
// ---------------------------------------------------------------------------

const BWV846_BARS: number[][] = [
  [48, 52, 55, 60, 64],
  [48, 50, 57, 62, 65],
  [47, 50, 55, 62, 65],
  [48, 52, 55, 60, 64],
  [48, 52, 57, 64, 69],
  [48, 50, 54, 57, 62],
  [47, 50, 55, 62, 67],
  [47, 48, 52, 55, 60],
  [45, 48, 52, 55, 60],
  [38, 45, 50, 54, 60],
  [43, 47, 50, 55, 59],
  [43, 46, 52, 55, 61],
  [41, 45, 50, 57, 62],
  [41, 44, 50, 53, 59],
  [40, 43, 48, 55, 60],
  [40, 41, 45, 48, 53],
];

/** 各半小節は 16分音符 8つ：低音2つ + 上声3つの反復 */
const BWV846_PATTERN = [0, 1, 2, 3, 4, 2, 3, 4];

function buildBWV846(): PerformanceEvent[] {
  const take = new Take(20240401);
  const quarter = 60 / 66;
  const sixteenth = quarter / 4;
  const bar = quarter * 4;

  BWV846_BARS.forEach((chord, barIndex) => {
    const barStart = barIndex * bar;
    take.pedalPerBar(barStart);

    // 曲の流れに沿った大きな強弱
    const arc = Math.sin((barIndex / BWV846_BARS.length) * Math.PI);
    const dynamic = 0.42 + arc * 0.22;

    for (let half = 0; half < 2; half++) {
      const halfStart = barStart + half * bar * 0.5;
      BWV846_PATTERN.forEach((slot, i) => {
        const time = halfStart + i * sixteenth;
        const note = chord[slot];
        const isBass = slot <= 1;
        // 低音2声は小節いっぱい保持、上声は次の音まで
        const duration = isBass ? bar * 0.5 - i * sixteenth : sixteenth * 2.4;
        const accent = i === 0 ? 0.1 : i === 2 ? 0.04 : 0;
        const vel = dynamic + accent + (isBass ? 0.05 : 0);
        take.note(time, note, duration, vel);
      });
    }
  });

  // 終止（ハ長調の主和音）
  const end = BWV846_BARS.length * bar;
  take.pedal(end - 0.03, 0);
  take.pedal(end + 0.05, 1);
  for (const note of [36, 48, 52, 55, 60, 64]) {
    take.note(end, note, bar * 1.6, 0.5);
  }
  take.pedal(end + bar * 1.8, 0);

  return take.done();
}

// ---------------------------------------------------------------------------
// オリジナル楽曲「夜明けのノクターン」（本アプリのために書き下ろし／権利処理不要）
// ---------------------------------------------------------------------------

/** 左手の分散和音（低音・中音・高音） */
const NOCTURNE_CHORDS: number[][] = [
  [45, 52, 57], // Am
  [41, 48, 57], // F
  [36, 48, 55], // C
  [43, 50, 59], // G
  [45, 52, 57], // Am
  [41, 48, 57], // F
  [36, 48, 55], // C
  [40, 52, 56], // E7
  [45, 52, 57], // Am
  [38, 50, 57], // Dm
  [43, 50, 59], // G
  [36, 48, 55], // C
  [41, 48, 57], // F
  [38, 50, 57], // Dm
  [40, 52, 56], // E7
  [45, 52, 57], // Am
];

/** 右手：[小節, 拍, 音高, 長さ(拍), 強さ] */
const NOCTURNE_MELODY: [number, number, number, number, number][] = [
  [0, 0, 76, 2, 0.62], [0, 2, 72, 1, 0.5], [0, 3, 74, 1, 0.52],
  [1, 0, 72, 3, 0.58], [1, 3, 69, 1, 0.48],
  [2, 0, 67, 2, 0.5], [2, 2, 69, 1, 0.48], [2, 3, 71, 1, 0.52],
  [3, 0, 71, 4, 0.55],
  [4, 0, 76, 2, 0.66], [4, 2, 79, 1, 0.62], [4, 3, 77, 1, 0.58],
  [5, 0, 76, 3, 0.6], [5, 3, 72, 1, 0.5],
  [6, 0, 74, 2, 0.54], [6, 2, 76, 2, 0.56],
  [7, 0, 71, 4, 0.5],
  [8, 0, 69, 1, 0.52], [8, 1, 72, 1, 0.54], [8, 2, 76, 2, 0.62],
  [9, 0, 77, 2, 0.66], [9, 2, 74, 2, 0.58],
  [10, 0, 71, 2, 0.56], [10, 2, 74, 2, 0.58],
  [11, 0, 72, 4, 0.54],
  [12, 0, 81, 2, 0.72], [12, 2, 79, 1, 0.64], [12, 3, 77, 1, 0.6],
  [13, 0, 76, 2, 0.58], [13, 2, 74, 2, 0.54],
  [14, 0, 71, 2, 0.5], [14, 2, 68, 2, 0.48],
  [15, 0, 69, 4, 0.5],
];

const NOCTURNE_PATTERN = [0, 1, 2, 1, 0, 1, 2, 1];

function buildNocturne(): PerformanceEvent[] {
  const take = new Take(19850612);
  const quarter = 60 / 72;
  const eighth = quarter / 2;
  const bar = quarter * 4;

  NOCTURNE_CHORDS.forEach((chord, barIndex) => {
    const barStart = barIndex * bar;
    take.pedalPerBar(barStart);
    NOCTURNE_PATTERN.forEach((slot, i) => {
      const time = barStart + i * eighth;
      const vel = (slot === 0 ? 0.42 : 0.3) + (i === 0 ? 0.06 : 0);
      take.note(time, chord[slot], eighth * 2.2, vel, 0.016);
    });
  });

  for (const [barIndex, beat, note, dur, vel] of NOCTURNE_MELODY) {
    take.note(barIndex * bar + beat * quarter, note, dur * quarter * 0.96, vel, 0.02);
  }

  // 終止：Am を静かに広げて終わる
  const end = NOCTURNE_CHORDS.length * bar;
  take.pedal(end - 0.03, 0);
  take.pedal(end + 0.05, 1);
  for (const note of [33, 45, 57, 60, 64, 69]) {
    take.note(end, note, bar * 2, 0.4);
  }
  take.pedal(end + bar * 2.2, 0);

  return take.done();
}

export const DEMOS: Demo[] = [
  {
    id: 'bwv846',
    title: '前奏曲 第1番 ハ長調 BWV 846',
    composer: 'J.S. バッハ',
    note: 'パブリックドメイン',
    presetId: 'concert',
    build: buildBWV846,
  },
  {
    id: 'nocturne',
    title: '夜明けのノクターン',
    composer: 'オリジナル',
    note: '本アプリ書き下ろし',
    presetId: 'warm',
    build: buildNocturne,
  },
];
