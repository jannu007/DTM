import { AudioEngine } from './AudioEngine';
import { SynthEngine } from './SynthEngine';
import type { Patch } from './types';
import { getPreset, clonePatch } from './presets';

export const PIANO_ROLL_MIN = 36; // C2
export const PIANO_ROLL_MAX = 84; // C6
export const STEPS_PER_BEAT = 4; // 16th-note resolution

export interface SeqNote {
  step: number;
  pitch: number;
  length: number; // in steps
  velocity: number;
}

export interface StepEvent {
  trackId: string;
  step: number;
  time: number;
}

export class Track {
  id: string;
  name: string;
  patch: Patch;
  pattern: SeqNote[] = [];
  patternLength = 16;
  muted = false;
  solo = false;
  volume = 0.85;
  pan = 0;

  input: GainNode;
  private panNode: StereoPannerNode;
  synth: SynthEngine;

  constructor(engine: AudioEngine, id: string, name: string, presetId: string) {
    this.id = id;
    this.name = name;
    this.patch = getPreset(presetId);
    this.input = engine.ctx.createGain();
    this.input.gain.value = this.volume;
    this.panNode = engine.ctx.createStereoPanner();
    this.input.connect(this.panNode);
    this.panNode.connect(engine.sumBus);
    this.synth = new SynthEngine(engine, this.input, this.patch);
  }

  setPreset(presetId: string) {
    this.patch = getPreset(presetId);
    this.synth.setPatch(this.patch);
  }

  updatePatch(patch: Patch) {
    this.patch = patch;
    this.synth.setPatch(patch);
  }

  setVolume(v: number) {
    this.volume = v;
    this.input.gain.setTargetAtTime(v, this.input.context.currentTime, 0.01);
  }

  setPan(p: number) {
    this.pan = p;
    this.panNode.pan.setTargetAtTime(p, this.input.context.currentTime, 0.01);
  }

  toggleNote(step: number, pitch: number, defaultLength = 1, velocity = 0.9) {
    const idx = this.pattern.findIndex((n) => n.step === step && n.pitch === pitch);
    if (idx >= 0) {
      this.pattern.splice(idx, 1);
    } else {
      this.pattern.push({ step, pitch, length: defaultLength, velocity });
    }
  }

  clear() {
    this.pattern = [];
  }
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

export class Sequencer {
  engine: AudioEngine;
  tracks: Track[] = [];
  bpm = 120;
  swing = 0;
  playing = false;

  private timer: number | null = null;
  private nextStepTime = 0;
  private globalTick = 0;
  onStep: ((e: StepEvent) => void) | null = null;
  private trackCounter = 0;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  addTrack(presetId: string, name?: string): Track {
    this.trackCounter++;
    const t = new Track(this.engine, `t${this.trackCounter}`, name ?? `Track ${this.trackCounter}`, presetId);
    this.tracks.push(t);
    return t;
  }

  removeTrack(id: string) {
    const idx = this.tracks.findIndex((t) => t.id === id);
    if (idx >= 0) {
      this.tracks[idx].synth.allNotesOff();
      this.tracks[idx].input.disconnect();
      this.tracks.splice(idx, 1);
    }
  }

  private stepDuration(): number {
    return 60 / this.bpm / STEPS_PER_BEAT;
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.engine.resume();
    this.globalTick = 0;
    this.nextStepTime = this.engine.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.tick(), LOOKAHEAD_MS);
  }

  stop() {
    this.playing = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    for (const t of this.tracks) t.synth.allNotesOff();
  }

  private tick() {
    const ctx = this.engine.ctx;
    while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      this.scheduleStep(this.globalTick, this.nextStepTime);
      const dur = this.stepDuration();
      const swingOffset = this.globalTick % 2 === 1 ? dur * this.swing * 0.5 : 0;
      this.nextStepTime += dur + swingOffset;
      this.globalTick++;
    }
  }

  private scheduleStep(tick: number, time: number) {
    const anySolo = this.tracks.some((t) => t.solo);
    const dur = this.stepDuration();
    for (const track of this.tracks) {
      if (track.muted) continue;
      if (anySolo && !track.solo) continue;
      const localStep = tick % track.patternLength;
      const notes = track.pattern.filter((n) => n.step === localStep);
      for (const note of notes) {
        if (track.patch.isDrum) {
          track.synth.triggerDrumOneShot(time, note.velocity);
        } else {
          track.synth.noteOn(note.pitch, note.velocity, time);
          track.synth.noteOff(note.pitch, time + dur * note.length * 0.92);
        }
      }
      if (this.onStep) {
        const delayMs = Math.max(0, (time - this.engine.ctx.currentTime) * 1000);
        const trackId = track.id;
        window.setTimeout(() => this.onStep?.({ trackId, step: localStep, time }), delayMs);
      }
    }
  }

  toJSON() {
    return {
      bpm: this.bpm,
      swing: this.swing,
      tracks: this.tracks.map((t) => ({
        name: t.name,
        patch: t.patch,
        pattern: t.pattern,
        patternLength: t.patternLength,
        muted: t.muted,
        solo: t.solo,
        volume: t.volume,
        pan: t.pan,
      })),
    };
  }

  loadJSON(data: ReturnType<Sequencer['toJSON']>) {
    this.stop();
    for (const t of [...this.tracks]) this.removeTrack(t.id);
    this.bpm = data.bpm;
    this.swing = data.swing;
    for (const td of data.tracks) {
      const t = this.addTrack(td.patch.id ?? 'lead1', td.name);
      t.updatePatch(clonePatch(td.patch));
      t.pattern = td.pattern;
      t.patternLength = td.patternLength;
      t.muted = td.muted;
      t.solo = td.solo;
      t.setVolume(td.volume);
      t.setPan(td.pan);
    }
  }
}
