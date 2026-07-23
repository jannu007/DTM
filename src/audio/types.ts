export type OscWave = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'pulse' | 'superSaw' | 'noise';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';
export type LfoWave = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'sampleHold';
export type LfoTarget = 'none' | 'pitch' | 'filter' | 'amp' | 'pan';
export type ArpMode = 'up' | 'down' | 'updown' | 'random' | 'order';
export type DrumType =
  | 'kick' | 'kick2' | 'snare' | 'rim' | 'clap' | 'hatClosed' | 'hatOpen'
  | 'tomLow' | 'tomMid' | 'tomHigh' | 'crash' | 'ride' | 'cowbell' | 'shaker' | 'clave';

export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface OscParams {
  wave: OscWave;
  octave: number;   // -2..2
  semitone: number; // -12..12
  detune: number;   // cents -50..50
  level: number;    // 0..1
  pulseWidth: number; // 0..1 for 'pulse' wave
}

export interface FilterParams {
  type: FilterType;
  cutoff: number;    // Hz 20..20000
  resonance: number; // Q 0.1..20
  envAmount: number; // -1..1
  keyTrack: number;  // 0..1
}

export interface LfoParams {
  wave: LfoWave;
  rate: number;   // Hz
  target: LfoTarget;
  amount: number; // 0..1
  syncedRate?: number; // steps per cycle when tempo-synced
}

export interface ArpParams {
  enabled: boolean;
  mode: ArpMode;
  octaves: number; // 1..4
  rate: number; // steps per beat (1,2,3,4)
  gate: number; // 0..1
}

export interface EffectsSend {
  chorus: number;
  delay: number;
  reverb: number;
  drive: number;
}

export interface Patch {
  id: string;
  name: string;
  category: string;
  isDrum: boolean;
  drumType?: DrumType;
  osc1: OscParams;
  osc2: OscParams;
  oscMix: number; // 0 = osc1 only, 1 = osc2 only
  noiseLevel: number;
  ringMod: boolean;
  oscSync: boolean;
  filter: FilterParams;
  filterEnv: Envelope;
  ampEnv: Envelope;
  lfo1: LfoParams;
  lfo2: LfoParams;
  portamento: number; // seconds
  fx: EffectsSend;
  volume: number; // 0..1
}
