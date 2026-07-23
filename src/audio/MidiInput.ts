export type NoteHandler = (note: number, velocity: number) => void;

export class MidiInput {
  private onNoteOn: NoteHandler;
  private onNoteOff: NoteHandler;
  access: any | null = null;
  connectedNames: string[] = [];
  onDevicesChanged: (() => void) | null = null;

  constructor(onNoteOn: NoteHandler, onNoteOff: NoteHandler) {
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
  }

  async init(): Promise<boolean> {
    if (!('requestMIDIAccess' in navigator)) return false;
    try {
      const access = await (navigator as any).requestMIDIAccess();
      this.access = access;
      this.attachAll();
      access.onstatechange = () => {
        this.attachAll();
        this.onDevicesChanged?.();
      };
      this.onDevicesChanged?.();
      return true;
    } catch {
      return false;
    }
  }

  private attachAll() {
    if (!this.access) return;
    this.connectedNames = [];
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = (e: any) => this.handleMessage(e);
      this.connectedNames.push(input.name ?? 'MIDI Device');
    }
  }

  private handleMessage(e: any) {
    const data = e.data;
    if (!data || data.length < 2) return;
    const status = data[0] & 0xf0;
    const note = data[1];
    const vel = data.length > 2 ? data[2] : 0;
    if (status === 0x90 && vel > 0) {
      this.onNoteOn(note, vel / 127);
    } else if (status === 0x80 || (status === 0x90 && vel === 0)) {
      this.onNoteOff(note, 0);
    }
  }
}

// Computer-keyboard "piano" mapping (2-row layout like most web synths)
const KEY_ORDER = [
  'KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM',
  'Comma', 'KeyL', 'Period', 'Semicolon', 'Slash',
  'KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU',
  'KeyI', 'Digit9', 'KeyO', 'Digit0', 'KeyP',
];

export class ComputerKeyboard {
  private onNoteOn: NoteHandler;
  private onNoteOff: NoteHandler;
  private octaveBase = 60; // C4
  private held: Set<string> = new Set();
  onOctaveChange: ((base: number) => void) | null = null;

  constructor(onNoteOn: NoteHandler, onNoteOff: NoteHandler) {
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    window.addEventListener('keydown', this.handleDown);
    window.addEventListener('keyup', this.handleUp);
  }

  private handleDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const target = e.target as HTMLElement;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    if (e.code === 'KeyZ' && e.shiftKey) return;
    if (e.code === 'ArrowLeft') {
      this.octaveBase = Math.max(24, this.octaveBase - 12);
      this.onOctaveChange?.(this.octaveBase);
      return;
    }
    if (e.code === 'ArrowRight') {
      this.octaveBase = Math.min(96, this.octaveBase + 12);
      this.onOctaveChange?.(this.octaveBase);
      return;
    }
    const idx = KEY_ORDER.indexOf(e.code);
    if (idx === -1 || this.held.has(e.code)) return;
    this.held.add(e.code);
    const note = this.octaveBase - 12 + idx;
    this.onNoteOn(note, 0.85);
  };

  private handleUp = (e: KeyboardEvent) => {
    const idx = KEY_ORDER.indexOf(e.code);
    if (idx === -1) return;
    this.held.delete(e.code);
    const note = this.octaveBase - 12 + idx;
    this.onNoteOff(note, 0);
  };

  dispose() {
    window.removeEventListener('keydown', this.handleDown);
    window.removeEventListener('keyup', this.handleUp);
  }
}
