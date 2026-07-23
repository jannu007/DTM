import type { AudioEngine } from './AudioEngine';
import type { Patch, OscParams, Envelope, DrumType } from './types';

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function oscRatio(o: OscParams): number {
  return Math.pow(2, o.octave + o.semitone / 12);
}

function buildPulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

function scheduleAttackDecay(
  param: AudioParam,
  t0: number,
  env: Envelope,
  base: number,
  peak: number,
  sustainVal: number
) {
  const a = Math.max(0.002, env.attack);
  const d = Math.max(0.005, env.decay);
  param.cancelScheduledValues(t0);
  param.setValueAtTime(base, t0);
  param.linearRampToValueAtTime(peak, t0 + a);
  param.linearRampToValueAtTime(sustainVal, t0 + a + d);
}

function scheduleRelease(param: AudioParam, tOff: number, env: Envelope, fromValue: number, toValue: number) {
  const r = Math.max(0.01, env.release);
  param.cancelScheduledValues(tOff);
  param.setValueAtTime(fromValue, tOff);
  param.linearRampToValueAtTime(toValue, tOff + r);
}

interface OscHandle {
  nodes: (OscillatorNode | AudioBufferSourceNode)[];
  outGain: GainNode;
  setFreq: (freq: number, time: number, glide: number) => void;
  detuneParams: AudioParam[];
}

export class Voice {
  private engine: AudioEngine;
  private patch: Patch;
  midiNote: number;
  private ctx: AudioContext;
  private outGain: GainNode;
  private ampLfoGain: GainNode;
  private filter: BiquadFilterNode;
  private panNode: StereoPannerNode;
  private drive: WaveShaperNode | null = null;
  private osc1: OscHandle | null = null;
  private osc2: OscHandle | null = null;
  private noiseSrc: AudioBufferSourceNode | null = null;
  private ringGain: GainNode | null = null;
  private lfoNodes: OscillatorNode[] = [];
  private stopped = false;
  private stopTimer: number | null = null;
  private baseFreq: number;
  private sustainAmpValue = 0;
  private sustainCutoffValue = 0;

  constructor(engine: AudioEngine, patch: Patch, midiNote: number, velocity: number, destination: AudioNode, startTime: number) {
    this.engine = engine;
    this.patch = patch;
    this.midiNote = midiNote;
    this.ctx = engine.ctx;
    const ctx = this.ctx;
    this.baseFreq = midiToFreq(midiNote);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = patch.filter.type;
    this.filter.Q.value = patch.filter.resonance;
    this.filter.frequency.value = patch.filter.cutoff;

    this.outGain = ctx.createGain();
    this.outGain.gain.value = 0;
    this.ampLfoGain = ctx.createGain();
    this.ampLfoGain.gain.value = 1;
    this.panNode = ctx.createStereoPanner();

    let preOut: AudioNode = this.filter;
    if (patch.fx.drive > 0) {
      this.drive = ctx.createWaveShaper();
      const n = 1024;
      const curve = new Float32Array(n);
      const k = patch.fx.drive * 60;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
      }
      this.drive.curve = curve as Float32Array<ArrayBuffer>;
      this.filter.connect(this.drive);
      preOut = this.drive;
    }
    preOut.connect(this.outGain);
    this.outGain.connect(this.ampLfoGain);
    this.ampLfoGain.connect(this.panNode);
    this.panNode.connect(destination);

    if (patch.fx.reverb > 0) {
      const g = ctx.createGain();
      g.gain.value = patch.fx.reverb;
      this.panNode.connect(g);
      g.connect(engine.reverbSend);
    }
    if (patch.fx.delay > 0) {
      const g = ctx.createGain();
      g.gain.value = patch.fx.delay;
      this.panNode.connect(g);
      g.connect(engine.delaySend);
    }
    if (patch.fx.chorus > 0) {
      const g = ctx.createGain();
      g.gain.value = patch.fx.chorus;
      this.panNode.connect(g);
      g.connect(engine.chorusSend);
    }

    const oscSumGain = ctx.createGain();
    oscSumGain.connect(this.filter);

    const freq1 = this.baseFreq * oscRatio(patch.osc1);
    let freq2 = this.baseFreq * oscRatio(patch.osc2);
    if (patch.oscSync && freq1 > 0) {
      const ratio = Math.max(1, Math.round(freq2 / freq1));
      freq2 = freq1 * ratio;
    }

    this.osc1 = this.buildOsc(patch.osc1, freq1, startTime);
    this.osc2 = patch.osc2.level > 0 || patch.ringMod ? this.buildOsc(patch.osc2, freq2, startTime) : null;

    if (patch.ringMod && this.osc1 && this.osc2) {
      this.ringGain = ctx.createGain();
      this.ringGain.gain.value = 0;
      this.osc1.outGain.connect(this.ringGain);
      this.osc2.outGain.connect(this.ringGain.gain);
      this.ringGain.connect(oscSumGain);
    } else {
      if (this.osc1) {
        const g1 = ctx.createGain();
        g1.gain.value = 1 - patch.oscMix;
        this.osc1.outGain.connect(g1);
        g1.connect(oscSumGain);
      }
      if (this.osc2) {
        const g2 = ctx.createGain();
        g2.gain.value = patch.oscMix;
        this.osc2.outGain.connect(g2);
        g2.connect(oscSumGain);
      }
    }

    if (patch.noiseLevel > 0) {
      this.noiseSrc = ctx.createBufferSource();
      this.noiseSrc.buffer = engine.noiseBuffer;
      this.noiseSrc.loop = true;
      const ng = ctx.createGain();
      ng.gain.value = patch.noiseLevel;
      this.noiseSrc.connect(ng);
      ng.connect(oscSumGain);
      this.noiseSrc.start(startTime);
    }

    // LFOs
    for (const lfo of [patch.lfo1, patch.lfo2]) {
      if (lfo.target === 'none' || lfo.amount <= 0) continue;
      const lfoOsc = ctx.createOscillator();
      lfoOsc.type = lfo.wave === 'sampleHold' ? 'square' : lfo.wave;
      lfoOsc.frequency.value = lfo.rate;
      const lg = ctx.createGain();
      if (lfo.target === 'pitch') {
        lg.gain.value = lfo.amount * 60;
        lfoOsc.connect(lg);
        if (this.osc1) for (const p of this.osc1.detuneParams) lg.connect(p);
        if (this.osc2) for (const p of this.osc2.detuneParams) lg.connect(p);
      } else if (lfo.target === 'filter') {
        lg.gain.value = lfo.amount * 3500;
        lfoOsc.connect(lg);
        lg.connect(this.filter.frequency);
      } else if (lfo.target === 'amp') {
        lg.gain.value = lfo.amount * 0.5;
        lfoOsc.connect(lg);
        lg.connect(this.ampLfoGain.gain);
      } else if (lfo.target === 'pan') {
        lg.gain.value = lfo.amount;
        lfoOsc.connect(lg);
        lg.connect(this.panNode.pan);
      }
      lfoOsc.start(startTime);
      this.lfoNodes.push(lfoOsc);
    }

    // envelopes
    const vel = Math.max(0.05, Math.min(1, velocity));
    const peakAmp = vel * patch.volume;
    this.sustainAmpValue = peakAmp * patch.ampEnv.sustain;
    scheduleAttackDecay(this.outGain.gain, startTime, patch.ampEnv, 0, peakAmp, this.sustainAmpValue);

    const filterRange = 6000 * (patch.filter.envAmount >= 0 ? 1 : -1);
    const peakCutoff = clampFreq(patch.filter.cutoff + Math.abs(patch.filter.envAmount) * filterRange * Math.sign(patch.filter.envAmount || 1));
    this.sustainCutoffValue = clampFreq(patch.filter.cutoff + patch.filter.envAmount * filterRange * patch.filterEnv.sustain);
    scheduleAttackDecay(this.filter.frequency, startTime, patch.filterEnv, patch.filter.cutoff, peakCutoff, this.sustainCutoffValue);
  }

  private buildOsc(o: OscParams, freq: number, startTime: number): OscHandle {
    const ctx = this.ctx;
    const outGain = ctx.createGain();
    outGain.gain.value = o.level;
    const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
    const detuneParams: AudioParam[] = [];
    let setFreq: (freq: number, time: number, glide: number) => void;

    if (o.wave === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.engine.noiseBuffer;
      src.loop = true;
      src.connect(outGain);
      src.start(startTime);
      nodes.push(src);
      setFreq = () => {};
    } else if (o.wave === 'superSaw') {
      const spread = [-14, -7, 0, 7, 14];
      const subGain = 1 / spread.length;
      for (const cents of spread) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = o.detune + cents;
        const g = ctx.createGain();
        g.gain.value = subGain;
        osc.connect(g);
        g.connect(outGain);
        osc.start(startTime);
        nodes.push(osc);
        detuneParams.push(osc.detune);
      }
      setFreq = (f, t, glide) => {
        for (const n of nodes) {
          const osc = n as OscillatorNode;
          if (glide > 0) osc.frequency.setTargetAtTime(f, t, glide / 4);
          else osc.frequency.setValueAtTime(f, t);
        }
      };
    } else if (o.wave === 'pulse') {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(buildPulseWave(ctx, Math.min(0.95, Math.max(0.05, o.pulseWidth))));
      osc.frequency.value = freq;
      osc.detune.value = o.detune;
      osc.connect(outGain);
      osc.start(startTime);
      nodes.push(osc);
      detuneParams.push(osc.detune);
      setFreq = (f, t, glide) => {
        if (glide > 0) osc.frequency.setTargetAtTime(f, t, glide / 4);
        else osc.frequency.setValueAtTime(f, t);
      };
    } else {
      const osc = ctx.createOscillator();
      osc.type = o.wave;
      osc.frequency.value = freq;
      osc.detune.value = o.detune;
      osc.connect(outGain);
      osc.start(startTime);
      nodes.push(osc);
      detuneParams.push(osc.detune);
      setFreq = (f, t, glide) => {
        if (glide > 0) osc.frequency.setTargetAtTime(f, t, glide / 4);
        else osc.frequency.setValueAtTime(f, t);
      };
    }

    return { nodes, outGain, setFreq, detuneParams };
  }

  setFrequency(midiNote: number, time: number, glideSeconds: number) {
    this.midiNote = midiNote;
    const freq = midiToFreq(midiNote);
    const f1 = freq * oscRatio(this.patch.osc1);
    let f2 = freq * oscRatio(this.patch.osc2);
    if (this.patch.oscSync && f1 > 0) {
      const ratio = Math.max(1, Math.round(f2 / f1));
      f2 = f1 * ratio;
    }
    this.osc1?.setFreq(f1, time, glideSeconds);
    this.osc2?.setFreq(f2, time, glideSeconds);
  }

  retrigger(velocity: number, time: number) {
    const vel = Math.max(0.05, Math.min(1, velocity));
    const peakAmp = vel * this.patch.volume;
    this.sustainAmpValue = peakAmp * this.patch.ampEnv.sustain;
    scheduleAttackDecay(this.outGain.gain, time, this.patch.ampEnv, 0, peakAmp, this.sustainAmpValue);
    const filterRange = 6000;
    const peakCutoff = clampFreq(this.patch.filter.cutoff + Math.abs(this.patch.filter.envAmount) * filterRange);
    this.sustainCutoffValue = clampFreq(this.patch.filter.cutoff + this.patch.filter.envAmount * filterRange * this.patch.filterEnv.sustain);
    scheduleAttackDecay(this.filter.frequency, time, this.patch.filterEnv, this.patch.filter.cutoff, peakCutoff, this.sustainCutoffValue);
  }

  noteOff(time: number) {
    if (this.stopped) return;
    scheduleRelease(this.outGain.gain, time, this.patch.ampEnv, this.sustainAmpValue, 0);
    scheduleRelease(this.filter.frequency, time, this.patch.filterEnv, this.sustainCutoffValue, this.patch.filter.cutoff);
    const stopAt = time + this.patch.ampEnv.release + 0.05;
    this.scheduleStop(stopAt);
  }

  forceStop(time: number) {
    if (this.stopped) return;
    this.outGain.gain.cancelScheduledValues(time);
    this.outGain.gain.setValueAtTime(this.outGain.gain.value, time);
    this.outGain.gain.linearRampToValueAtTime(0, time + 0.03);
    this.scheduleStop(time + 0.05);
  }

  private scheduleStop(time: number) {
    this.stopped = true;
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    this.stopTimer = window.setTimeout(() => {
      const all = [...(this.osc1?.nodes ?? []), ...(this.osc2?.nodes ?? []), ...this.lfoNodes];
      if (this.noiseSrc) all.push(this.noiseSrc);
      for (const n of all) {
        try {
          (n as any).stop();
        } catch {
          /* already stopped */
        }
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
      this.outGain.disconnect();
      this.ampLfoGain.disconnect();
      this.filter.disconnect();
      this.panNode.disconnect();
      this.drive?.disconnect();
      this.ringGain?.disconnect();
    }, delayMs);
  }

  dispose() {
    if (this.stopTimer) window.clearTimeout(this.stopTimer);
  }
}

function clampFreq(v: number): number {
  return Math.max(20, Math.min(19000, v));
}

// ---- Drum one-shot synthesis ----
export function playDrum(
  engine: AudioEngine,
  drumType: DrumType,
  destination: AudioNode,
  time: number,
  velocity: number,
  volume: number,
  fx?: { chorus: number; delay: number; reverb: number }
) {
  const ctx = engine.ctx;
  const vel = Math.max(0.05, Math.min(1, velocity)) * volume;

  const voiceOut = ctx.createGain();
  voiceOut.gain.value = 1;
  voiceOut.connect(destination);
  if (fx) {
    if (fx.reverb > 0) {
      const g = ctx.createGain();
      g.gain.value = fx.reverb;
      voiceOut.connect(g);
      g.connect(engine.reverbSend);
    }
    if (fx.delay > 0) {
      const g = ctx.createGain();
      g.gain.value = fx.delay;
      voiceOut.connect(g);
      g.connect(engine.delaySend);
    }
    if (fx.chorus > 0) {
      const g = ctx.createGain();
      g.gain.value = fx.chorus;
      voiceOut.connect(g);
      g.connect(engine.chorusSend);
    }
  }
  destination = voiceOut;

  function env(gain: GainNode, peak: number, attack: number, decay: number, t0: number) {
    gain.gain.cancelScheduledValues(t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.001), t0 + attack + decay);
  }

  function noiseBurst(t0: number, decay: number, peak: number, filterType: BiquadFilterType, freq: number, q = 1) {
    const src = ctx.createBufferSource();
    src.buffer = engine.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const g = ctx.createGain();
    env(g, peak, 0.001, decay, t0);
    src.connect(filt);
    filt.connect(g);
    g.connect(destination);
    src.start(t0);
    src.stop(t0 + decay + 0.1);
  }

  function tone(t0: number, freq: number, endFreq: number, decay: number, peak: number, wave: OscillatorType = 'sine') {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + decay);
    const g = ctx.createGain();
    env(g, peak, 0.001, decay, t0);
    osc.connect(g);
    g.connect(destination);
    osc.start(t0);
    osc.stop(t0 + decay + 0.1);
  }

  switch (drumType) {
    case 'kick':
      tone(time, 150, 45, 0.25, vel * 1.1);
      noiseBurst(time, 0.03, vel * 0.3, 'lowpass', 400);
      break;
    case 'kick2':
      tone(time, 100, 30, 0.5, vel * 1.2, 'sine');
      break;
    case 'snare':
      tone(time, 200, 120, 0.12, vel * 0.6, 'triangle');
      noiseBurst(time, 0.18, vel * 0.9, 'highpass', 1500);
      break;
    case 'rim':
      tone(time, 800, 400, 0.05, vel * 0.5, 'square');
      noiseBurst(time, 0.03, vel * 0.3, 'highpass', 3000);
      break;
    case 'clap':
      for (let i = 0; i < 3; i++) noiseBurst(time + i * 0.012, 0.15, vel * 0.7, 'bandpass', 1200, 2);
      break;
    case 'hatClosed':
      noiseBurst(time, 0.04, vel * 0.6, 'highpass', 7000);
      break;
    case 'hatOpen':
      noiseBurst(time, 0.35, vel * 0.6, 'highpass', 7000);
      break;
    case 'tomLow':
      tone(time, 150, 80, 0.3, vel);
      break;
    case 'tomMid':
      tone(time, 220, 110, 0.28, vel);
      break;
    case 'tomHigh':
      tone(time, 300, 150, 0.25, vel);
      break;
    case 'crash':
      noiseBurst(time, 1.2, vel * 0.7, 'highpass', 5000, 0.7);
      break;
    case 'ride':
      noiseBurst(time, 0.8, vel * 0.5, 'highpass', 6000, 3);
      tone(time, 2500, 2500, 0.6, vel * 0.15, 'square');
      break;
    case 'cowbell':
      tone(time, 800, 800, 0.3, vel * 0.5, 'square');
      tone(time, 540, 540, 0.3, vel * 0.4, 'square');
      break;
    case 'shaker':
      noiseBurst(time, 0.1, vel * 0.4, 'bandpass', 6000, 1.5);
      break;
    case 'clave':
      tone(time, 2500, 2000, 0.06, vel * 0.5, 'sine');
      break;
  }
}
