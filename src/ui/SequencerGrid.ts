import type { Track } from '../audio/Sequencer';
import { PIANO_ROLL_MIN, PIANO_ROLL_MAX } from '../audio/Sequencer';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteName(n: number): string {
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
}

export function buildSequencerGrid(
  container: HTMLElement,
  track: Track,
  onChange: () => void
): { highlightStep: (step: number) => void } {
  container.innerHTML = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'grid-toolbar';
  const lenSel = document.createElement('select');
  for (const len of [8, 16, 32, 64]) {
    const opt = document.createElement('option');
    opt.value = String(len);
    opt.textContent = `${len} steps`;
    if (len === track.patternLength) opt.selected = true;
    lenSel.appendChild(opt);
  }
  lenSel.addEventListener('change', () => {
    track.patternLength = Number(lenSel.value);
    onChange();
    render();
  });
  const clearBtn = document.createElement('button');
  clearBtn.className = 'small-btn';
  clearBtn.textContent = 'クリア';
  clearBtn.addEventListener('click', () => {
    track.clear();
    onChange();
    render();
  });
  toolbar.appendChild(lenSel);
  toolbar.appendChild(clearBtn);
  container.appendChild(toolbar);

  const scrollArea = document.createElement('div');
  scrollArea.className = 'grid-scroll';
  container.appendChild(scrollArea);

  const grid = document.createElement('div');
  grid.className = 'piano-roll';
  scrollArea.appendChild(grid);

  const cellEls: Map<string, HTMLElement> = new Map();
  const columnEls: HTMLElement[][] = [];

  function render() {
    grid.innerHTML = '';
    cellEls.clear();
    columnEls.length = 0;
    const steps = track.patternLength;
    grid.style.gridTemplateColumns = `56px repeat(${steps}, var(--step-w))`;

    for (let n = PIANO_ROLL_MAX; n >= PIANO_ROLL_MIN; n--) {
      const rowLabel = document.createElement('div');
      rowLabel.className = 'row-label' + (n % 12 === 0 ? ' c-row' : '');
      rowLabel.textContent = noteName(n);
      grid.appendChild(rowLabel);

      for (let s = 0; s < steps; s++) {
        const cell = document.createElement('div');
        cell.className = 'roll-cell' + (n % 12 === 0 ? ' c-row' : '') + (Math.floor(s / 4) % 2 === 0 ? ' beat-a' : ' beat-b');
        const has = track.pattern.some((note) => note.step === s && note.pitch === n);
        if (has) cell.classList.add('filled');
        cell.addEventListener('click', () => {
          track.toggleNote(s, n);
          cell.classList.toggle('filled');
          onChange();
        });
        grid.appendChild(cell);
        cellEls.set(`${s}:${n}`, cell);
        if (!columnEls[s]) columnEls[s] = [];
        columnEls[s].push(cell);
      }
    }
  }

  render();

  let lastStep = -1;
  function highlightStep(step: number) {
    if (lastStep >= 0 && columnEls[lastStep]) {
      for (const c of columnEls[lastStep]) c.classList.remove('playhead');
    }
    if (columnEls[step]) {
      for (const c of columnEls[step]) c.classList.add('playhead');
    }
    lastStep = step;
  }

  return { highlightStep };
}
