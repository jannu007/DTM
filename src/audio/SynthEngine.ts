import { AudioEngine } from './AudioEngine';
import { Voice, playDrum } from './Voice';
import type { Patch } from './types';

const MAX_POLY = 16;

export class SynthEngine {
  engine: AudioEngine;
  destination: AudioNode;
  patch: Patch;
  private voices: Map<number, Voice> = new Map();
  private monoVoice: Voice | null = null;
  private heldNotes: number[] = [];
  private voiceOrder: number[] = [];

  constructor(engine: AudioEngine, destination: AudioNode, patch: Patch) {
    this.engine = engine;
    this.destination = destination;
    this.patch = patch;
  }

  setPatch(patch: Patch) {
    this.patch = patch;
  }

  get isMono(): boolean {
    return this.patch.portamento > 0;
  }

  noteOn(note: number, velocity: number, time = this.engine.ctx.currentTime) {
    if (this.patch.isDrum) {
      playDrum(this.engine, this.patch.drumType!, this.destination, time, velocity, this.patch.volume, this.patch.fx);
      return;
    }
    if (this.isMono) {
      this.heldNotes = this.heldNotes.filter((n) => n !== note);
      this.heldNotes.push(note);
      if (this.monoVoice) {
        this.monoVoice.setFrequency(note, time, this.patch.portamento);
        this.monoVoice.retrigger(velocity, time);
      } else {
        this.monoVoice = new Voice(this.engine, this.patch, note, velocity, this.destination, time);
      }
      return;
    }
    const existing = this.voices.get(note);
    if (existing) {
      existing.forceStop(time);
      this.voices.delete(note);
    }
    if (this.voices.size >= MAX_POLY) {
      const oldest = this.voiceOrder.shift();
      if (oldest !== undefined) {
        this.voices.get(oldest)?.forceStop(time);
        this.voices.delete(oldest);
      }
    }
    const v = new Voice(this.engine, this.patch, note, velocity, this.destination, time);
    this.voices.set(note, v);
    this.voiceOrder.push(note);
  }

  noteOff(note: number, time = this.engine.ctx.currentTime) {
    if (this.patch.isDrum) return;
    if (this.isMono) {
      this.heldNotes = this.heldNotes.filter((n) => n !== note);
      if (this.heldNotes.length > 0) {
        const last = this.heldNotes[this.heldNotes.length - 1];
        this.monoVoice?.setFrequency(last, time, this.patch.portamento);
      } else {
        this.monoVoice?.noteOff(time);
        this.monoVoice = null;
      }
      return;
    }
    const v = this.voices.get(note);
    if (v) {
      v.noteOff(time);
      this.voices.delete(note);
      this.voiceOrder = this.voiceOrder.filter((n) => n !== note);
    }
  }

  allNotesOff(time = this.engine.ctx.currentTime) {
    for (const v of this.voices.values()) v.forceStop(time);
    this.voices.clear();
    this.voiceOrder = [];
    if (this.monoVoice) {
      this.monoVoice.forceStop(time);
      this.monoVoice = null;
    }
    this.heldNotes = [];
  }

  triggerDrumOneShot(time: number, velocity: number) {
    if (this.patch.isDrum) playDrum(this.engine, this.patch.drumType!, this.destination, time, velocity, this.patch.volume, this.patch.fx);
  }
}
