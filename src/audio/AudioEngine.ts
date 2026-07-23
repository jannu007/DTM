function buildReverbImpulse(ctx: AudioContext, seconds = 2.5, decay = 3): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export function buildNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(1, length, rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function makeDriveCurve(amount: number): Float32Array {
  const n = 1024;
  const curve = new Float32Array(n);
  const k = amount * 100;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

export class AudioEngine {
  ctx: AudioContext;
  noiseBuffer: AudioBuffer;

  sumBus: GainNode;
  masterGain: GainNode;
  compressor: DynamicsCompressorNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;

  reverbSend: GainNode;
  reverbReturn: GainNode;
  convolver: ConvolverNode;

  delaySend: GainNode;
  delayReturn: GainNode;
  delayNode: DelayNode;
  delayFeedback: GainNode;

  chorusSend: GainNode;
  chorusReturn: GainNode;
  chorusDelayL: DelayNode;
  chorusDelayR: DelayNode;
  chorusLfo: OscillatorNode;
  chorusLfoGain: GainNode;

  masterDrive: WaveShaperNode;

  recDest: MediaStreamAudioDestinationNode;
  recProcessor: ScriptProcessorNode | null = null;
  recording = false;
  recChunksL: Float32Array[] = [];
  recChunksR: Float32Array[] = [];

  analyser: AnalyserNode;

  constructor() {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.ctx = ctx;
    this.noiseBuffer = buildNoiseBuffer(ctx);

    this.sumBus = ctx.createGain();
    this.masterDrive = ctx.createWaveShaper();
    this.masterDrive.curve = makeDriveCurve(0) as Float32Array<ArrayBuffer>;
    this.eqLow = ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 200;
    this.eqMid = ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 0.7;
    this.eqHigh = ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 4000;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.85;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    // reverb bus
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0;
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = buildReverbImpulse(ctx);
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 1;

    // delay bus
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0;
    this.delayNode = ctx.createDelay(2);
    this.delayNode.delayTime.value = 0.32;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.35;
    this.delayReturn = ctx.createGain();
    this.delayReturn.gain.value = 1;

    // chorus bus (stereo modulated short delay)
    this.chorusSend = ctx.createGain();
    this.chorusSend.gain.value = 0;
    this.chorusDelayL = ctx.createDelay(0.05);
    this.chorusDelayL.delayTime.value = 0.012;
    this.chorusDelayR = ctx.createDelay(0.05);
    this.chorusDelayR.delayTime.value = 0.017;
    this.chorusLfo = ctx.createOscillator();
    this.chorusLfo.frequency.value = 0.6;
    this.chorusLfoGain = ctx.createGain();
    this.chorusLfoGain.gain.value = 0.004;
    this.chorusLfo.connect(this.chorusLfoGain);
    this.chorusLfoGain.connect(this.chorusDelayL.delayTime);
    this.chorusLfoGain.connect(this.chorusDelayR.delayTime);
    this.chorusLfo.start();
    this.chorusReturn = ctx.createGain();
    this.chorusReturn.gain.value = 1;

    // wire graph
    this.sumBus.connect(this.masterDrive);
    this.masterDrive.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.reverbSend.connect(this.convolver);
    this.convolver.connect(this.reverbReturn);
    this.reverbReturn.connect(this.sumBus);

    this.delaySend.connect(this.delayNode);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.delayReturn);
    this.delayReturn.connect(this.sumBus);

    this.chorusSend.connect(this.chorusDelayL);
    this.chorusSend.connect(this.chorusDelayR);
    this.chorusDelayL.connect(this.chorusReturn);
    this.chorusDelayR.connect(this.chorusReturn);
    this.chorusReturn.connect(this.sumBus);

    this.recDest = ctx.createMediaStreamDestination();
  }

  resume() {
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  setMasterVolume(v: number) {
    this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  setEQ(low: number, mid: number, high: number) {
    this.eqLow.gain.setTargetAtTime(low, this.ctx.currentTime, 0.01);
    this.eqMid.gain.setTargetAtTime(mid, this.ctx.currentTime, 0.01);
    this.eqHigh.gain.setTargetAtTime(high, this.ctx.currentTime, 0.01);
  }

  setDelayTime(sec: number) {
    this.delayNode.delayTime.setTargetAtTime(sec, this.ctx.currentTime, 0.01);
  }

  setDelayFeedback(fb: number) {
    this.delayFeedback.gain.setTargetAtTime(fb, this.ctx.currentTime, 0.01);
  }

  // --- Recording (raw PCM capture -> WAV encode) ---
  startRecording() {
    if (this.recording) return;
    this.recording = true;
    this.recChunksL = [];
    this.recChunksR = [];
    const bufSize = 4096;
    this.recProcessor = this.ctx.createScriptProcessor(bufSize, 2, 2);
    this.masterGain.connect(this.recProcessor);
    this.recProcessor.connect(this._silentSink());
    this.recProcessor.onaudioprocess = (e) => {
      if (!this.recording) return;
      const l = e.inputBuffer.getChannelData(0);
      const r = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : l;
      this.recChunksL.push(new Float32Array(l));
      this.recChunksR.push(new Float32Array(r));
    };
  }

  private _silentGain: GainNode | null = null;
  private _silentSink(): GainNode {
    if (!this._silentGain) {
      this._silentGain = this.ctx.createGain();
      this._silentGain.gain.value = 0;
      this._silentGain.connect(this.ctx.destination);
    }
    return this._silentGain;
  }

  stopRecording(): Blob | null {
    if (!this.recording) return null;
    this.recording = false;
    if (this.recProcessor) {
      this.masterGain.disconnect(this.recProcessor);
      this.recProcessor.disconnect();
      this.recProcessor = null;
    }
    if (this.recChunksL.length === 0) return null;
    const totalLen = this.recChunksL.reduce((s, a) => s + a.length, 0);
    const left = new Float32Array(totalLen);
    const right = new Float32Array(totalLen);
    let off = 0;
    for (let i = 0; i < this.recChunksL.length; i++) {
      left.set(this.recChunksL[i], off);
      right.set(this.recChunksR[i], off);
      off += this.recChunksL[i].length;
    }
    return encodeWav([left, right], this.ctx.sampleRate);
  }
}

export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const numChannels = channels.length;
  const numFrames = channels[0].length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let s = Math.max(-1, Math.min(1, channels[ch][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, s, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
