import type { Patch, DrumType, FilterType } from './types';

function osc(over: Partial<Patch['osc1']> = {}): Patch['osc1'] {
  return { wave: 'sawtooth', octave: 0, semitone: 0, detune: 0, level: 1, pulseWidth: 0.5, ...over };
}

function filt(type: FilterType, cutoff: number, resonance: number, envAmount: number, keyTrack = 0.5): Patch['filter'] {
  return { type, cutoff, resonance, envAmount, keyTrack };
}

function env(a: number, d: number, s: number, r: number) {
  return { attack: a, decay: d, sustain: s, release: r };
}

function base(id: string, name: string, category: string, over: Partial<Patch>): Patch {
  const defaults: Patch = {
    id,
    name,
    category,
    isDrum: false,
    osc1: osc(),
    osc2: osc({ wave: 'sawtooth', semitone: 0, detune: 6, level: 0 }),
    oscMix: 0,
    noiseLevel: 0,
    ringMod: false,
    oscSync: false,
    filter: { type: 'lowpass', cutoff: 4000, resonance: 1, envAmount: 0.4, keyTrack: 0.5 },
    filterEnv: env(0.005, 0.25, 0.3, 0.3),
    ampEnv: env(0.005, 0.15, 0.8, 0.25),
    lfo1: { wave: 'triangle', rate: 4, target: 'none', amount: 0 },
    lfo2: { wave: 'sine', rate: 0.5, target: 'none', amount: 0 },
    portamento: 0,
    fx: { chorus: 0, delay: 0, reverb: 0.15, drive: 0 },
    volume: 0.8,
  };
  return { ...defaults, ...over, id, name, category };
}

function drum(id: string, name: string, drumType: DrumType, over: Partial<Patch> = {}): Patch {
  return base(id, name, 'ドラム', {
    isDrum: true,
    drumType,
    fx: { chorus: 0, delay: 0, reverb: 0.05, drive: 0 },
    ...over,
  });
}

export const PRESETS: Patch[] = [
  // ---- ANALOG BASS ----
  base('bass1', 'Deep Sub Bass', 'ベース', {
    osc1: osc({ wave: 'sine', octave: -1 }),
    osc2: osc({ wave: 'triangle', octave: -1, detune: 4, level: 0.5 }),
    oscMix: 0.3,
    filter: { type: 'lowpass', cutoff: 900, resonance: 2, envAmount: 0.3, keyTrack: 0.3 },
    ampEnv: env(0.002, 0.1, 0.9, 0.15),
  }),
  base('bass2', 'Analog Mono Bass', 'ベース', {
    osc1: osc({ wave: 'sawtooth', octave: -1 }),
    osc2: osc({ wave: 'square', octave: -1, detune: 8, level: 0.6 }),
    oscMix: 0.4,
    filter: { type: 'lowpass', cutoff: 700, resonance: 6, envAmount: 0.6, keyTrack: 0.4 },
    filterEnv: env(0.002, 0.18, 0.2, 0.2),
  }),
  base('bass3', 'Acid Bass 303', 'ベース', {
    osc1: osc({ wave: 'sawtooth', octave: -1 }),
    oscMix: 0,
    filter: { type: 'lowpass', cutoff: 500, resonance: 14, envAmount: 0.8, keyTrack: 0.5 },
    filterEnv: env(0.001, 0.3, 0.05, 0.15),
    fx: { chorus: 0, delay: 0.1, reverb: 0.1, drive: 0.3 },
  }),
  base('bass4', 'Wobble Bass', 'ベース', {
    osc1: osc({ wave: 'square', octave: -1 }),
    osc2: osc({ wave: 'sawtooth', octave: -1, detune: 5, level: 0.7 }),
    oscMix: 0.5,
    filter: filt('lowpass', 400, 10, 0.3),
    lfo1: { wave: 'sine', rate: 3, target: 'filter', amount: 0.8 },
    fx: { chorus: 0, delay: 0, reverb: 0.1, drive: 0.2 },
  }),
  base('bass5', 'FM-ish Growl Bass', 'ベース', {
    osc1: osc({ wave: 'square', octave: -1 }),
    osc2: osc({ wave: 'sawtooth', octave: 0, detune: 0, level: 0.4 }),
    oscMix: 0.35,
    ringMod: true,
    filter: filt('lowpass', 900, 8, 0.5),
  }),

  // ---- SYNTH LEAD ----
  base('lead1', 'Classic Saw Lead', 'リード', {
    osc1: osc({ wave: 'sawtooth' }),
    osc2: osc({ wave: 'sawtooth', detune: 9, level: 0.7 }),
    oscMix: 0.45,
    filter: { type: 'lowpass', cutoff: 5000, resonance: 3, envAmount: 0.3, keyTrack: 0.6 },
    ampEnv: env(0.005, 0.1, 0.85, 0.2),
    fx: { chorus: 0.3, delay: 0.15, reverb: 0.2, drive: 0 },
  }),
  base('lead2', 'Super Saw Trance Lead', 'リード', {
    osc1: osc({ wave: 'superSaw' }),
    osc2: osc({ wave: 'superSaw', octave: 1, level: 0.3 }),
    oscMix: 0.2,
    filter: filt('lowpass', 6000, 2, 0.2),
    fx: { chorus: 0.4, delay: 0.25, reverb: 0.3, drive: 0.1 },
  }),
  base('lead3', 'Square Chip Lead', 'リード', {
    osc1: osc({ wave: 'square' }),
    filter: filt('lowpass', 4500, 1, 0.1),
    ampEnv: env(0.001, 0.05, 1, 0.05),
    fx: { chorus: 0, delay: 0.2, reverb: 0.1, drive: 0 },
  }),
  base('lead4', 'Sync Lead', 'リード', {
    osc1: osc({ wave: 'sawtooth' }),
    osc2: osc({ wave: 'sawtooth', semitone: 7, detune: 0, level: 0.8 }),
    oscMix: 0.5,
    oscSync: true,
    filter: filt('lowpass', 5000, 5, 0.5),
  }),
  base('lead5', 'PWM Lead', 'リード', {
    osc1: osc({ wave: 'pulse', pulseWidth: 0.3 }),
    lfo2: { wave: 'triangle', rate: 0.3, target: 'none', amount: 0 },
    filter: filt('lowpass', 4200, 2, 0.3),
  }),
  base('lead6', 'Ring Mod Lead', 'リード', {
    osc1: osc({ wave: 'sawtooth' }),
    osc2: osc({ wave: 'triangle', semitone: 5, level: 0.9 }),
    oscMix: 0.5,
    ringMod: true,
    filter: filt('bandpass', 3000, 4, 0.4),
  }),

  // ---- POLY SYNTH / PAD ----
  base('pad1', 'Warm Analog Pad', 'パッド', {
    osc1: osc({ wave: 'sawtooth' }),
    osc2: osc({ wave: 'triangle', detune: 7, level: 0.6 }),
    oscMix: 0.4,
    filter: { type: 'lowpass', cutoff: 2500, resonance: 1, envAmount: 0.2, keyTrack: 0.3 },
    ampEnv: env(0.6, 0.4, 0.8, 1.2),
    filterEnv: env(0.8, 0.6, 0.6, 1),
    fx: { chorus: 0.5, delay: 0.2, reverb: 0.5, drive: 0 },
  }),
  base('pad2', 'Choir Strings Pad', 'パッド', {
    osc1: osc({ wave: 'sawtooth' }),
    osc2: osc({ wave: 'square', octave: 1, level: 0.3 }),
    oscMix: 0.25,
    filter: filt('lowpass', 2200, 0.7, 0.15),
    ampEnv: env(0.9, 0.5, 0.85, 1.5),
    fx: { chorus: 0.6, delay: 0.1, reverb: 0.6, drive: 0 },
  }),
  base('pad3', 'Glass Bell Pad', 'パッド', {
    osc1: osc({ wave: 'sine' }),
    osc2: osc({ wave: 'triangle', octave: 1, detune: 3, level: 0.7 }),
    oscMix: 0.5,
    filter: filt('lowpass', 6000, 2, 0.3),
    ampEnv: env(0.3, 0.8, 0.5, 1.8),
    fx: { chorus: 0.3, delay: 0.3, reverb: 0.7, drive: 0 },
  }),
  base('pad4', 'Dark Drone Pad', 'パッド', {
    osc1: osc({ wave: 'sawtooth', octave: -1 }),
    osc2: osc({ wave: 'sawtooth', octave: -1, detune: 10, level: 0.8 }),
    oscMix: 0.5,
    filter: filt('lowpass', 900, 3, 0.1),
    ampEnv: env(1.2, 0.6, 0.9, 2),
    fx: { chorus: 0.2, delay: 0, reverb: 0.6, drive: 0.1 },
  }),

  // ---- KEYS / ORGAN ----
  base('keys1', 'Electric Piano', 'キーボード', {
    osc1: osc({ wave: 'sine' }),
    osc2: osc({ wave: 'triangle', semitone: 12, level: 0.35 }),
    oscMix: 0.3,
    filter: filt('lowpass', 3500, 1, 0.2),
    ampEnv: env(0.002, 0.6, 0.3, 0.5),
    fx: { chorus: 0.4, delay: 0, reverb: 0.25, drive: 0 },
  }),
  base('keys2', 'Drawbar Organ', 'キーボード', {
    osc1: osc({ wave: 'sine' }),
    osc2: osc({ wave: 'square', octave: 1, level: 0.4 }),
    oscMix: 0.35,
    filter: filt('lowpass', 8000, 0.5, 0),
    ampEnv: env(0.01, 0.05, 1, 0.1),
    lfo1: { wave: 'sine', rate: 5.5, target: 'amp', amount: 0.15 },
    fx: { chorus: 0.3, delay: 0, reverb: 0.2, drive: 0 },
  }),
  base('keys3', 'Clav', 'キーボード', {
    osc1: osc({ wave: 'square' }),
    filter: filt('bandpass', 2000, 5, 0.6),
    ampEnv: env(0.001, 0.15, 0.1, 0.1),
    fx: { chorus: 0.1, delay: 0.15, reverb: 0.15, drive: 0.1 },
  }),
  base('keys4', 'Music Box Bell', 'キーボード', {
    osc1: osc({ wave: 'sine', octave: 1 }),
    osc2: osc({ wave: 'sine', octave: 2, detune: 5, level: 0.5 }),
    oscMix: 0.4,
    filter: filt('lowpass', 9000, 0.5, 0),
    ampEnv: env(0.001, 1.2, 0, 0.8),
    fx: { chorus: 0.2, delay: 0.35, reverb: 0.5, drive: 0 },
  }),

  // ---- BELL / PLUCK ----
  base('bell1', 'FM Bell', 'ベル/プラック', {
    osc1: osc({ wave: 'sine' }),
    osc2: osc({ wave: 'sine', semitone: 19, level: 0.5 }),
    oscMix: 0.35,
    ringMod: true,
    filter: filt('lowpass', 7000, 1, 0),
    ampEnv: env(0.001, 1.5, 0, 1),
    fx: { chorus: 0.2, delay: 0.2, reverb: 0.5, drive: 0 },
  }),
  base('pluck1', 'Synth Pluck', 'ベル/プラック', {
    osc1: osc({ wave: 'triangle' }),
    osc2: osc({ wave: 'square', octave: 1, level: 0.3 }),
    oscMix: 0.25,
    filter: filt('lowpass', 3500, 3, 0.7),
    filterEnv: env(0.001, 0.2, 0, 0.2),
    ampEnv: env(0.001, 0.3, 0, 0.2),
    fx: { chorus: 0.1, delay: 0.2, reverb: 0.25, drive: 0 },
  }),
  base('pluck2', 'Harp Pluck', 'ベル/プラック', {
    osc1: osc({ wave: 'triangle' }),
    filter: filt('lowpass', 6000, 1, 0.2),
    ampEnv: env(0.001, 0.9, 0, 0.6),
    fx: { chorus: 0.15, delay: 0.3, reverb: 0.45, drive: 0 },
  }),

  // ---- BRASS / STRINGS ----
  base('brass1', 'Analog Brass', 'ブラス/ストリングス', {
    osc1: osc({ wave: 'sawtooth' }),
    osc2: osc({ wave: 'square', detune: 6, level: 0.5 }),
    oscMix: 0.4,
    filter: { type: 'lowpass', cutoff: 3000, resonance: 2, envAmount: 0.5, keyTrack: 0.5 },
    filterEnv: env(0.08, 0.3, 0.6, 0.3),
    ampEnv: env(0.06, 0.15, 0.85, 0.3),
    fx: { chorus: 0.3, delay: 0, reverb: 0.3, drive: 0.1 },
  }),
  base('strings1', 'Ensemble Strings', 'ブラス/ストリングス', {
    osc1: osc({ wave: 'sawtooth' }),
    osc2: osc({ wave: 'sawtooth', detune: 11, level: 0.8 }),
    oscMix: 0.5,
    filter: filt('lowpass', 3200, 0.7, 0.15),
    ampEnv: env(0.4, 0.3, 0.85, 0.8),
    fx: { chorus: 0.5, delay: 0, reverb: 0.5, drive: 0 },
  }),

  // ---- SFX / TRANCE GATE ----
  base('sfx1', 'Trance Gate Pad', 'SFX', {
    osc1: osc({ wave: 'sawtooth' }),
    osc2: osc({ wave: 'square', detune: 8, level: 0.6 }),
    oscMix: 0.4,
    filter: filt('lowpass', 4000, 2, 0.2),
    lfo1: { wave: 'square', rate: 8, target: 'amp', amount: 0.9 },
    ampEnv: env(0.5, 0.3, 0.85, 1),
    fx: { chorus: 0.3, delay: 0.3, reverb: 0.4, drive: 0 },
  }),
  base('sfx2', 'Sweep Riser', 'SFX', {
    osc1: osc({ wave: 'sawtooth' }),
    osc2: osc({ wave: 'noise', level: 0.3 }),
    oscMix: 0.2,
    filter: filt('bandpass', 500, 6, 0.95),
    filterEnv: env(1.5, 0.4, 1, 0.6),
    ampEnv: env(1.5, 0.2, 1, 0.4),
    fx: { chorus: 0, delay: 0.2, reverb: 0.5, drive: 0.1 },
  }),
  base('sfx3', 'Alien Wobble', 'SFX', {
    osc1: osc({ wave: 'square' }),
    osc2: osc({ wave: 'triangle', semitone: 3, level: 0.6 }),
    oscMix: 0.4,
    ringMod: true,
    lfo1: { wave: 'sine', rate: 6, target: 'pitch', amount: 0.3 },
    lfo2: { wave: 'triangle', rate: 1.5, target: 'filter', amount: 0.7 },
    filter: filt('lowpass', 2500, 8, 0.3),
  }),
  base('sfx4', 'Noise Wind', 'SFX', {
    osc1: osc({ wave: 'noise' }),
    filter: filt('bandpass', 1200, 3, 0.1),
    ampEnv: env(1, 0.5, 0.8, 1.5),
    lfo1: { wave: 'sine', rate: 0.2, target: 'filter', amount: 0.6 },
    fx: { chorus: 0, delay: 0, reverb: 0.6, drive: 0 },
  }),

  // ---- DRUMS ----
  drum('dr_kick1', 'Kick (Analog)', 'kick'),
  drum('dr_kick2', 'Kick (Deep 808)', 'kick2'),
  drum('dr_snare1', 'Snare', 'snare'),
  drum('dr_rim1', 'Rim Shot', 'rim'),
  drum('dr_clap1', 'Clap', 'clap'),
  drum('dr_hatc1', 'Hi-Hat Closed', 'hatClosed'),
  drum('dr_hato1', 'Hi-Hat Open', 'hatOpen'),
  drum('dr_tomlo', 'Tom Low', 'tomLow'),
  drum('dr_tommid', 'Tom Mid', 'tomMid'),
  drum('dr_tomhi', 'Tom High', 'tomHigh'),
  drum('dr_crash', 'Crash Cymbal', 'crash'),
  drum('dr_ride', 'Ride Cymbal', 'ride'),
  drum('dr_cowbell', 'Cowbell', 'cowbell'),
  drum('dr_shaker', 'Shaker', 'shaker'),
  drum('dr_clave', 'Clave', 'clave'),
];

export const CATEGORIES = Array.from(new Set(PRESETS.map((p) => p.category)));

export function getPreset(id: string): Patch {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown preset: ${id}`);
  return JSON.parse(JSON.stringify(p));
}

export function clonePatch(p: Patch): Patch {
  return JSON.parse(JSON.stringify(p));
}
