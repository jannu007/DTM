import { AudioEngine } from '../audio/AudioEngine';
import { Sequencer, Track } from '../audio/Sequencer';
import { Arpeggiator } from '../audio/Arpeggiator';
import { MidiInput, ComputerKeyboard } from '../audio/MidiInput';
import { PRESETS } from '../audio/presets';
import type { ArpParams } from '../audio/types';
import { buildSynthPanel } from './SynthPanel';
import { buildPatchBrowser } from './PatchBrowser';
import { buildSequencerGrid } from './SequencerGrid';
import { buildVirtualKeyboard } from './Keyboard';
import { createKnob } from './Knob';

const DEFAULT_TRACKS: { preset: string; name: string }[] = [
  { preset: 'dr_kick1', name: 'Kick' },
  { preset: 'dr_snare1', name: 'Snare' },
  { preset: 'dr_hatc1', name: 'HiHat' },
  { preset: 'bass2', name: 'Bass' },
  { preset: 'lead1', name: 'Lead' },
  { preset: 'pad1', name: 'Pad' },
];

export class App {
  engine!: AudioEngine;
  sequencer!: Sequencer;
  selectedTrackId = '';
  arpParams: ArpParams = { enabled: false, mode: 'up', octaves: 1, rate: 2, gate: 0.8 };
  arp: Arpeggiator | null = null;
  midi!: MidiInput;
  computerKeyboard!: ComputerKeyboard;
  gridApi: { highlightStep: (step: number) => void } | null = null;
  root: HTMLElement;
  private bpmKnob: HTMLElement | null = null;
  private swingKnob: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.start();
  }

  private start() {
    this.engine = new AudioEngine();
    this.engine.resume();
    this.sequencer = new Sequencer(this.engine);
    for (const d of DEFAULT_TRACKS) this.sequencer.addTrack(d.preset, d.name);
    this.selectedTrackId = this.sequencer.tracks[0].id;
    this.rebindArp();

    this.midi = new MidiInput(
      (note, vel) => this.handleNoteOn(note, vel),
      (note) => this.handleNoteOff(note)
    );
    this.midi.init();
    this.midi.onDevicesChanged = () => this.updateMidiStatus();

    this.computerKeyboard = new ComputerKeyboard(
      (note, vel) => this.handleNoteOn(note, vel),
      (note) => this.handleNoteOff(note)
    );

    this.sequencer.onStep = (e) => {
      if (e.trackId === this.selectedTrackId) this.gridApi?.highlightStep(e.step);
    };

    this.buildLayout();
  }

  private get selectedTrack(): Track {
    return this.sequencer.tracks.find((t) => t.id === this.selectedTrackId) ?? this.sequencer.tracks[0];
  }

  private rebindArp() {
    this.arp?.dispose();
    this.arp = new Arpeggiator(this.selectedTrack.synth, () => this.sequencer.bpm, this.arpParams);
  }

  private handleNoteOn(note: number, vel: number) {
    this.engine.resume();
    if (this.arpParams.enabled) this.arp?.noteOn(note, vel);
    else this.selectedTrack.synth.noteOn(note, vel);
  }

  private handleNoteOff(note: number) {
    if (this.arpParams.enabled) this.arp?.noteOff(note);
    else this.selectedTrack.synth.noteOff(note);
  }

  private updateMidiStatus() {
    const el = document.getElementById('midi-status');
    if (el) {
      el.textContent = this.midi.connectedNames.length > 0 ? `MIDI: ${this.midi.connectedNames.join(', ')}` : 'MIDI: なし';
    }
  }

  // ---------------------------------------------------------------------
  private buildLayout() {
    this.root.innerHTML = '';
    const app = document.createElement('div');
    app.className = 'app-shell';

    app.appendChild(this.buildTransport());

    const main = document.createElement('div');
    main.className = 'main-area';

    const left = document.createElement('div');
    left.className = 'panel-left';
    left.id = 'track-list';
    main.appendChild(left);

    const center = document.createElement('div');
    center.className = 'panel-center';

    const lcd = document.createElement('div');
    lcd.className = 'lcd-display';
    lcd.id = 'lcd-display';
    center.appendChild(lcd);

    const synthPanel = document.createElement('div');
    synthPanel.id = 'synth-panel';
    center.appendChild(synthPanel);

    const patchBrowser = document.createElement('div');
    patchBrowser.id = 'patch-browser';
    patchBrowser.className = 'patch-browser-container';
    center.appendChild(patchBrowser);

    main.appendChild(center);
    app.appendChild(main);

    const bottom = document.createElement('div');
    bottom.className = 'panel-bottom';
    const gridContainer = document.createElement('div');
    gridContainer.id = 'sequencer-grid';
    gridContainer.className = 'sequencer-grid-container';
    const kbContainer = document.createElement('div');
    kbContainer.id = 'keyboard-container';
    bottom.appendChild(gridContainer);
    bottom.appendChild(kbContainer);
    app.appendChild(bottom);

    const status = document.createElement('div');
    status.className = 'status-bar';
    status.innerHTML = `<span id="midi-status">MIDI: なし</span><span>矢印キー: オクターブ切替 / ZSXDCVGBHNJM,QWERTY...: 演奏キー</span>`;
    app.appendChild(status);

    this.root.appendChild(app);

    this.renderTrackList();
    this.renderSynthPanel();
    this.renderPatchBrowser();
    this.renderSequencerGrid();
    this.renderKeyboard();
    this.updateMidiStatus();
  }

  private buildTransport(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'transport-bar';

    const playBtn = document.createElement('button');
    playBtn.className = 'transport-btn play';
    playBtn.textContent = '▶ PLAY';
    playBtn.addEventListener('click', () => {
      if (this.sequencer.playing) {
        this.sequencer.stop();
        playBtn.textContent = '▶ PLAY';
        playBtn.classList.remove('active');
      } else {
        this.sequencer.play();
        playBtn.textContent = '■ STOP';
        playBtn.classList.add('active');
      }
    });
    bar.appendChild(playBtn);

    const bpmKnob = createKnob({
      label: 'BPM',
      min: 40,
      max: 240,
      step: 1,
      value: this.sequencer.bpm,
      format: (v) => v.toFixed(0),
      onChange: (v) => {
        this.sequencer.bpm = Math.round(v);
      },
    });
    bar.appendChild(bpmKnob);
    this.bpmKnob = bpmKnob;

    const swingKnob = createKnob({
      label: 'Swing',
      min: 0,
      max: 1,
      value: this.sequencer.swing,
      format: (v) => v.toFixed(2),
      onChange: (v) => {
        this.sequencer.swing = v;
      },
    });
    bar.appendChild(swingKnob);
    this.swingKnob = swingKnob;

    const volKnob = createKnob({
      label: 'Master',
      min: 0,
      max: 1,
      value: 0.85,
      format: (v) => v.toFixed(2),
      onChange: (v) => this.engine.setMasterVolume(v),
    });
    bar.appendChild(volKnob);

    const eqState = { low: 0, mid: 0, high: 0 };
    const eqLow = createKnob({ label: 'EQ Low', min: -15, max: 15, bipolar: true, value: 0, format: (v) => v.toFixed(0), onChange: (v) => { eqState.low = v; this.engine.setEQ(eqState.low, eqState.mid, eqState.high); } });
    const eqMid = createKnob({ label: 'EQ Mid', min: -15, max: 15, bipolar: true, value: 0, format: (v) => v.toFixed(0), onChange: (v) => { eqState.mid = v; this.engine.setEQ(eqState.low, eqState.mid, eqState.high); } });
    const eqHigh = createKnob({ label: 'EQ High', min: -15, max: 15, bipolar: true, value: 0, format: (v) => v.toFixed(0), onChange: (v) => { eqState.high = v; this.engine.setEQ(eqState.low, eqState.mid, eqState.high); } });
    bar.appendChild(eqLow);
    bar.appendChild(eqMid);
    bar.appendChild(eqHigh);

    const recBtn = document.createElement('button');
    recBtn.className = 'transport-btn rec';
    recBtn.textContent = '● REC';
    recBtn.addEventListener('click', () => {
      if (this.engine.recording) {
        const blob = this.engine.stopRecording();
        recBtn.textContent = '● REC';
        recBtn.classList.remove('active');
        if (blob) this.downloadBlob(blob, `micro-sakura-studio-recording-${Date.now()}.wav`);
      } else {
        this.engine.startRecording();
        recBtn.textContent = '● REC中...';
        recBtn.classList.add('active');
      }
    });
    bar.appendChild(recBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'transport-btn';
    saveBtn.textContent = '保存';
    saveBtn.addEventListener('click', () => this.saveSong());
    bar.appendChild(saveBtn);

    const loadInput = document.createElement('input');
    loadInput.type = 'file';
    loadInput.accept = 'application/json';
    loadInput.style.display = 'none';
    loadInput.addEventListener('change', () => this.loadSongFile(loadInput));
    const loadBtn = document.createElement('button');
    loadBtn.className = 'transport-btn';
    loadBtn.textContent = '読込';
    loadBtn.addEventListener('click', () => loadInput.click());
    bar.appendChild(loadBtn);
    bar.appendChild(loadInput);

    const logo = document.createElement('div');
    logo.className = 'brand-logo';
    logo.textContent = 'MICRO SAKURA STUDIO';
    bar.insertBefore(logo, bar.firstChild);

    return bar;
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  private saveSong() {
    const data = this.sequencer.toJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, `micro-sakura-studio-song-${Date.now()}.json`);
    localStorage.setItem('micro-sakura-studio-autosave', JSON.stringify(data));
  }

  private loadSongFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        this.sequencer.loadJSON(data);
        this.selectedTrackId = this.sequencer.tracks[0]?.id ?? '';
        this.rebindArp();
        this.renderTrackList();
        this.renderSynthPanel();
        this.renderSequencerGrid();
        (this.bpmKnob as any)?.setKnobValue(this.sequencer.bpm);
        (this.swingKnob as any)?.setKnobValue(this.sequencer.swing);
      } catch (err) {
        alert('読み込みに失敗しました: ' + err);
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  // ---------------------------------------------------------------------
  private renderTrackList() {
    const container = document.getElementById('track-list');
    if (!container) return;
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'track-list-header';
    header.textContent = 'トラック';
    container.appendChild(header);

    for (const t of this.sequencer.tracks) {
      const row = document.createElement('div');
      row.className = 'track-row' + (t.id === this.selectedTrackId ? ' selected' : '');

      const nameEl = document.createElement('div');
      nameEl.className = 'track-name';
      nameEl.textContent = t.name;
      nameEl.addEventListener('click', () => {
        this.selectedTrackId = t.id;
        this.rebindArp();
        this.renderTrackList();
        this.renderSynthPanel();
        this.renderPatchBrowser();
        this.renderSequencerGrid();
      });
      row.appendChild(nameEl);

      const patchName = document.createElement('div');
      patchName.className = 'track-patch-name';
      patchName.textContent = t.patch.name;
      row.appendChild(patchName);

      const controls = document.createElement('div');
      controls.className = 'track-controls';

      const muteBtn = document.createElement('button');
      muteBtn.className = 'mini-btn' + (t.muted ? ' on' : '');
      muteBtn.textContent = 'M';
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        t.muted = !t.muted;
        muteBtn.classList.toggle('on', t.muted);
      });
      controls.appendChild(muteBtn);

      const soloBtn = document.createElement('button');
      soloBtn.className = 'mini-btn' + (t.solo ? ' on' : '');
      soloBtn.textContent = 'S';
      soloBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        t.solo = !t.solo;
        soloBtn.classList.toggle('on', t.solo);
      });
      controls.appendChild(soloBtn);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'mini-btn';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.sequencer.tracks.length <= 1) return;
        const wasSelected = t.id === this.selectedTrackId;
        this.sequencer.removeTrack(t.id);
        if (wasSelected) this.selectedTrackId = this.sequencer.tracks[0].id;
        this.rebindArp();
        this.renderTrackList();
        this.renderSynthPanel();
        this.renderSequencerGrid();
      });
      controls.appendChild(removeBtn);

      row.appendChild(controls);

      const volPan = document.createElement('div');
      volPan.className = 'track-volpan';
      volPan.appendChild(
        createKnob({ label: 'Vol', min: 0, max: 1, value: t.volume, format: (v) => v.toFixed(2), onChange: (v) => t.setVolume(v) })
      );
      volPan.appendChild(
        createKnob({ label: 'Pan', min: -1, max: 1, bipolar: true, value: t.pan, format: (v) => v.toFixed(2), onChange: (v) => t.setPan(v) })
      );
      row.appendChild(volPan);

      container.appendChild(row);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'add-track-btn';
    addBtn.textContent = '+ トラック追加';
    addBtn.addEventListener('click', () => {
      const t = this.sequencer.addTrack(PRESETS[0].id, `Track ${this.sequencer.tracks.length + 1}`);
      this.selectedTrackId = t.id;
      this.rebindArp();
      this.renderTrackList();
      this.renderSynthPanel();
      this.renderPatchBrowser();
      this.renderSequencerGrid();
    });
    container.appendChild(addBtn);
  }

  private renderSynthPanel() {
    const container = document.getElementById('synth-panel');
    const lcd = document.getElementById('lcd-display');
    if (!container) return;
    const track = this.selectedTrack;
    if (lcd) lcd.textContent = `${track.name} : ${track.patch.name}`;
    buildSynthPanel(
      container,
      track.patch,
      () => {
        track.synth.setPatch(track.patch);
        if (lcd) lcd.textContent = `${track.name} : ${track.patch.name}`;
      },
      this.arpParams,
      (enabled) => {
        this.arpParams.enabled = enabled;
      }
    );
  }

  private renderPatchBrowser() {
    const container = document.getElementById('patch-browser');
    if (!container) return;
    const track = this.selectedTrack;
    buildPatchBrowser(container, track.patch.id, (id) => {
      track.setPreset(id);
      this.renderTrackList();
      this.renderSynthPanel();
      this.renderPatchBrowser();
    });
  }

  private renderSequencerGrid() {
    const container = document.getElementById('sequencer-grid');
    if (!container) return;
    const track = this.selectedTrack;
    this.gridApi = buildSequencerGrid(container, track, () => {});
  }

  private renderKeyboard() {
    const container = document.getElementById('keyboard-container');
    if (!container) return;
    buildVirtualKeyboard(
      container,
      48,
      84,
      (note, vel) => this.handleNoteOn(note, vel),
      (note) => this.handleNoteOff(note)
    );
  }
}
