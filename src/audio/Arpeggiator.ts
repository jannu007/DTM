import type { SynthEngine } from './SynthEngine';
import type { ArpParams } from './types';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

export class Arpeggiator {
  private synth: SynthEngine;
  private getTempo: () => number;
  params: ArpParams;
  private heldNotes: number[] = [];
  private timer: number | null = null;
  private nextNoteTime = 0;
  private stepIndex = 0;
  private direction = 1;
  private lastVelocity = 0.9;
  private orderedSeq: number[] = [];

  constructor(synth: SynthEngine, getTempo: () => number, params: ArpParams) {
    this.synth = synth;
    this.getTempo = getTempo;
    this.params = params;
  }

  noteOn(note: number, velocity: number) {
    if (!this.heldNotes.includes(note)) this.heldNotes.push(note);
    this.lastVelocity = velocity;
    this.rebuildSequence();
    if (this.params.enabled && this.timer === null) this.start();
  }

  noteOff(note: number) {
    this.heldNotes = this.heldNotes.filter((n) => n !== note);
    this.rebuildSequence();
    if (this.heldNotes.length === 0) {
      this.synth.allNotesOff();
    }
  }

  setEnabled(enabled: boolean) {
    this.params.enabled = enabled;
    if (enabled && this.heldNotes.length > 0) this.start();
    if (!enabled) this.stop();
  }

  private rebuildSequence() {
    const notes = [...this.heldNotes].sort((a, b) => a - b);
    const octaves = Math.max(1, this.params.octaves);
    const expanded: number[] = [];
    for (let o = 0; o < octaves; o++) {
      for (const n of notes) expanded.push(n + o * 12);
    }
    switch (this.params.mode) {
      case 'up':
        this.orderedSeq = expanded;
        break;
      case 'down':
        this.orderedSeq = expanded.slice().reverse();
        break;
      case 'updown':
        this.orderedSeq = expanded.concat(expanded.slice(1, -1).reverse());
        break;
      case 'order':
        this.orderedSeq = this.heldNotes.slice();
        break;
      case 'random':
        this.orderedSeq = expanded;
        break;
      default:
        this.orderedSeq = expanded;
    }
    if (this.stepIndex >= this.orderedSeq.length) this.stepIndex = 0;
  }

  private start() {
    if (this.timer !== null) return;
    this.stepIndex = 0;
    this.nextNoteTime = this.synth.engine.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.tick(), LOOKAHEAD_MS);
  }

  private stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private stepDuration(): number {
    const bpm = this.getTempo();
    const beatSec = 60 / bpm;
    return beatSec / Math.max(1, this.params.rate);
  }

  private tick() {
    const ctx = this.synth.engine.ctx;
    while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      if (this.orderedSeq.length > 0) {
        let idx = this.stepIndex;
        if (this.params.mode === 'random') idx = Math.floor(Math.random() * this.orderedSeq.length);
        const note = this.orderedSeq[idx % this.orderedSeq.length];
        const dur = this.stepDuration();
        this.synth.noteOn(note, this.lastVelocity, this.nextNoteTime);
        this.synth.noteOff(note, this.nextNoteTime + dur * Math.max(0.05, this.params.gate));
        this.stepIndex = (this.stepIndex + 1) % Math.max(1, this.orderedSeq.length);
        this.nextNoteTime += dur;
      } else {
        this.nextNoteTime += this.stepDuration();
      }
    }
  }

  dispose() {
    this.stop();
  }
}
