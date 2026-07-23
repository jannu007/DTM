import { createKnob, createSelect, createToggle, moduleBox } from './Knob';
import type { Patch, OscWave, FilterType, LfoWave, LfoTarget, ArpMode, DrumType } from '../audio/types';
import type { ArpParams } from '../audio/types';

const DRUM_OPTIONS: { value: DrumType; text: string }[] = [
  { value: 'kick', text: 'Kick (Analog)' },
  { value: 'kick2', text: 'Kick (Deep 808)' },
  { value: 'snare', text: 'Snare' },
  { value: 'rim', text: 'Rim Shot' },
  { value: 'clap', text: 'Clap' },
  { value: 'hatClosed', text: 'Hi-Hat Closed' },
  { value: 'hatOpen', text: 'Hi-Hat Open' },
  { value: 'tomLow', text: 'Tom Low' },
  { value: 'tomMid', text: 'Tom Mid' },
  { value: 'tomHigh', text: 'Tom High' },
  { value: 'crash', text: 'Crash Cymbal' },
  { value: 'ride', text: 'Ride Cymbal' },
  { value: 'cowbell', text: 'Cowbell' },
  { value: 'shaker', text: 'Shaker' },
  { value: 'clave', text: 'Clave' },
];

const WAVE_OPTIONS: { value: OscWave; text: string }[] = [
  { value: 'sawtooth', text: 'Saw' },
  { value: 'square', text: 'Square' },
  { value: 'pulse', text: 'Pulse' },
  { value: 'triangle', text: 'Triangle' },
  { value: 'sine', text: 'Sine' },
  { value: 'superSaw', text: 'Super Saw' },
  { value: 'noise', text: 'Noise' },
];

const FILTER_OPTIONS: { value: FilterType; text: string }[] = [
  { value: 'lowpass', text: 'LPF' },
  { value: 'highpass', text: 'HPF' },
  { value: 'bandpass', text: 'BPF' },
  { value: 'notch', text: 'Notch' },
];

const LFO_WAVE_OPTIONS: { value: LfoWave; text: string }[] = [
  { value: 'triangle', text: 'Triangle' },
  { value: 'sine', text: 'Sine' },
  { value: 'sawtooth', text: 'Saw' },
  { value: 'square', text: 'Square' },
  { value: 'sampleHold', text: 'S&H' },
];

const LFO_TARGET_OPTIONS: { value: LfoTarget; text: string }[] = [
  { value: 'none', text: 'Off' },
  { value: 'pitch', text: 'Pitch' },
  { value: 'filter', text: 'Filter' },
  { value: 'amp', text: 'Amp' },
  { value: 'pan', text: 'Pan' },
];

const ARP_MODE_OPTIONS: { value: ArpMode; text: string }[] = [
  { value: 'up', text: 'Up' },
  { value: 'down', text: 'Down' },
  { value: 'updown', text: 'Up/Down' },
  { value: 'random', text: 'Random' },
  { value: 'order', text: 'Order' },
];

export function buildSynthPanel(
  container: HTMLElement,
  patch: Patch,
  onChange: () => void,
  arp: ArpParams,
  onArpChange: (enabled: boolean) => void
) {
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'synth-grid';
  container.appendChild(grid);

  if (patch.isDrum) {
    grid.appendChild(
      moduleBox(
        'DRUM VOICE',
        createSelect('Type', DRUM_OPTIONS, patch.drumType ?? 'kick', (v) => { patch.drumType = v as DrumType; onChange(); }),
        createKnob({ label: 'Volume', min: 0, max: 1, value: patch.volume, format: (v) => v.toFixed(2), onChange: (v) => { patch.volume = v; onChange(); } })
      )
    );
    grid.appendChild(
      moduleBox(
        'EFFECTS SEND',
        createKnob({ label: 'Chorus', min: 0, max: 1, value: patch.fx.chorus, format: (v) => v.toFixed(2), onChange: (v) => { patch.fx.chorus = v; onChange(); } }),
        createKnob({ label: 'Delay', min: 0, max: 1, value: patch.fx.delay, format: (v) => v.toFixed(2), onChange: (v) => { patch.fx.delay = v; onChange(); } }),
        createKnob({ label: 'Reverb', min: 0, max: 1, value: patch.fx.reverb, format: (v) => v.toFixed(2), onChange: (v) => { patch.fx.reverb = v; onChange(); } })
      )
    );
    return;
  }

  function oscModule(title: string, o: Patch['osc1']) {
    return moduleBox(
      title,
      createSelect('Wave', WAVE_OPTIONS, o.wave, (v) => {
        o.wave = v as OscWave;
        onChange();
      }),
      createKnob({ label: 'Octave', min: -2, max: 2, step: 1, value: o.octave, format: (v) => v.toFixed(0), onChange: (v) => { o.octave = Math.round(v); onChange(); } }),
      createKnob({ label: 'Semi', min: -12, max: 12, step: 1, bipolar: true, value: o.semitone, format: (v) => v.toFixed(0), onChange: (v) => { o.semitone = Math.round(v); onChange(); } }),
      createKnob({ label: 'Detune', min: -50, max: 50, bipolar: true, value: o.detune, format: (v) => v.toFixed(0) + 'c', onChange: (v) => { o.detune = v; onChange(); } }),
      createKnob({ label: 'Level', min: 0, max: 1, value: o.level, format: (v) => v.toFixed(2), onChange: (v) => { o.level = v; onChange(); } }),
      createKnob({ label: 'PW', min: 0.05, max: 0.95, value: o.pulseWidth, format: (v) => v.toFixed(2), onChange: (v) => { o.pulseWidth = v; onChange(); } })
    );
  }

  grid.appendChild(oscModule('OSC 1', patch.osc1));
  grid.appendChild(oscModule('OSC 2', patch.osc2));

  grid.appendChild(
    moduleBox(
      'MIXER',
      createKnob({ label: 'OSC Mix', min: 0, max: 1, value: patch.oscMix, format: (v) => v.toFixed(2), onChange: (v) => { patch.oscMix = v; onChange(); } }),
      createKnob({ label: 'Noise', min: 0, max: 1, value: patch.noiseLevel, format: (v) => v.toFixed(2), onChange: (v) => { patch.noiseLevel = v; onChange(); } }),
      createToggle('Ring Mod', patch.ringMod, (v) => { patch.ringMod = v; onChange(); }),
      createToggle('Osc Sync', patch.oscSync, (v) => { patch.oscSync = v; onChange(); }),
      createKnob({ label: 'Portamento', min: 0, max: 1, value: patch.portamento, format: (v) => v.toFixed(2) + 's', onChange: (v) => { patch.portamento = v; onChange(); } }),
      createKnob({ label: 'Volume', min: 0, max: 1, value: patch.volume, format: (v) => v.toFixed(2), onChange: (v) => { patch.volume = v; onChange(); } })
    )
  );

  grid.appendChild(
    moduleBox(
      'FILTER',
      createSelect('Type', FILTER_OPTIONS, patch.filter.type, (v) => { patch.filter.type = v as FilterType; onChange(); }),
      createKnob({ label: 'Cutoff', min: 20, max: 18000, value: patch.filter.cutoff, format: (v) => Math.round(v) + 'Hz', onChange: (v) => { patch.filter.cutoff = v; onChange(); } }),
      createKnob({ label: 'Reso', min: 0.1, max: 20, value: patch.filter.resonance, format: (v) => v.toFixed(1), onChange: (v) => { patch.filter.resonance = v; onChange(); } }),
      createKnob({ label: 'Env Amt', min: -1, max: 1, bipolar: true, value: patch.filter.envAmount, format: (v) => v.toFixed(2), onChange: (v) => { patch.filter.envAmount = v; onChange(); } }),
      createKnob({ label: 'Key Trk', min: 0, max: 1, value: patch.filter.keyTrack, format: (v) => v.toFixed(2), onChange: (v) => { patch.filter.keyTrack = v; onChange(); } })
    )
  );

  function envModule(title: string, e: Patch['ampEnv']) {
    return moduleBox(
      title,
      createKnob({ label: 'Attack', min: 0.001, max: 3, value: e.attack, format: (v) => v.toFixed(3) + 's', onChange: (v) => { e.attack = v; onChange(); } }),
      createKnob({ label: 'Decay', min: 0.001, max: 3, value: e.decay, format: (v) => v.toFixed(3) + 's', onChange: (v) => { e.decay = v; onChange(); } }),
      createKnob({ label: 'Sustain', min: 0, max: 1, value: e.sustain, format: (v) => v.toFixed(2), onChange: (v) => { e.sustain = v; onChange(); } }),
      createKnob({ label: 'Release', min: 0.001, max: 4, value: e.release, format: (v) => v.toFixed(3) + 's', onChange: (v) => { e.release = v; onChange(); } })
    );
  }
  grid.appendChild(envModule('AMP EG', patch.ampEnv));
  grid.appendChild(envModule('FILTER EG', patch.filterEnv));

  function lfoModule(title: string, l: Patch['lfo1']) {
    return moduleBox(
      title,
      createSelect('Wave', LFO_WAVE_OPTIONS, l.wave, (v) => { l.wave = v as LfoWave; onChange(); }),
      createSelect('Target', LFO_TARGET_OPTIONS, l.target, (v) => { l.target = v as LfoTarget; onChange(); }),
      createKnob({ label: 'Rate', min: 0.05, max: 20, value: l.rate, format: (v) => v.toFixed(2) + 'Hz', onChange: (v) => { l.rate = v; onChange(); } }),
      createKnob({ label: 'Amount', min: 0, max: 1, value: l.amount, format: (v) => v.toFixed(2), onChange: (v) => { l.amount = v; onChange(); } })
    );
  }
  grid.appendChild(lfoModule('LFO 1', patch.lfo1));
  grid.appendChild(lfoModule('LFO 2', patch.lfo2));

  grid.appendChild(
    moduleBox(
      'EFFECTS SEND',
      createKnob({ label: 'Drive', min: 0, max: 1, value: patch.fx.drive, format: (v) => v.toFixed(2), onChange: (v) => { patch.fx.drive = v; onChange(); } }),
      createKnob({ label: 'Chorus', min: 0, max: 1, value: patch.fx.chorus, format: (v) => v.toFixed(2), onChange: (v) => { patch.fx.chorus = v; onChange(); } }),
      createKnob({ label: 'Delay', min: 0, max: 1, value: patch.fx.delay, format: (v) => v.toFixed(2), onChange: (v) => { patch.fx.delay = v; onChange(); } }),
      createKnob({ label: 'Reverb', min: 0, max: 1, value: patch.fx.reverb, format: (v) => v.toFixed(2), onChange: (v) => { patch.fx.reverb = v; onChange(); } })
    )
  );

  grid.appendChild(
    moduleBox(
      'ARPEGGIATOR',
      createToggle('ON', arp.enabled, (v) => onArpChange(v)),
      createSelect('Mode', ARP_MODE_OPTIONS, arp.mode, (v) => { arp.mode = v as ArpMode; }),
      createKnob({ label: 'Octaves', min: 1, max: 4, step: 1, value: arp.octaves, format: (v) => v.toFixed(0), onChange: (v) => { arp.octaves = Math.round(v); } }),
      createKnob({ label: 'Rate', min: 1, max: 4, step: 1, value: arp.rate, format: (v) => v.toFixed(0) + '/beat', onChange: (v) => { arp.rate = Math.round(v); } }),
      createKnob({ label: 'Gate', min: 0.1, max: 1, value: arp.gate, format: (v) => v.toFixed(2), onChange: (v) => { arp.gate = v; } })
    )
  );
}
