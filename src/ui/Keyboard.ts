const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export function buildVirtualKeyboard(
  container: HTMLElement,
  lowNote: number,
  highNote: number,
  onNoteOn: (note: number, velocity: number) => void,
  onNoteOff: (note: number) => void
): { setOctaveIndicator: (base: number) => void; highlightNote: (note: number, on: boolean) => void } {
  container.innerHTML = '';
  const kb = document.createElement('div');
  kb.className = 'virtual-keyboard';

  const whiteKeys: HTMLElement[] = [];
  let whiteIndex = 0;
  const noteToEl = new Map<number, HTMLElement>();

  for (let n = lowNote; n <= highNote; n++) {
    if (!BLACK_KEYS.has(n % 12)) {
      const key = document.createElement('div');
      key.className = 'key white';
      key.dataset.note = String(n);
      kb.appendChild(key);
      whiteKeys.push(key);
      noteToEl.set(n, key);
      whiteIndex++;
    }
  }
  whiteIndex = 0;
  for (let n = lowNote; n <= highNote; n++) {
    if (!BLACK_KEYS.has(n % 12)) {
      whiteIndex++;
    } else {
      const key = document.createElement('div');
      key.className = 'key black';
      key.dataset.note = String(n);
      key.style.left = `calc(${whiteIndex} * var(--key-w) - var(--key-w) * 0.3)`;
      kb.appendChild(key);
      noteToEl.set(n, key);
    }
  }

  let activePointerNote: number | null = null;
  let mouseIsDown = false;
  window.addEventListener('mousedown', () => { mouseIsDown = true; });
  window.addEventListener('mouseup', () => { mouseIsDown = false; });

  function press(note: number) {
    onNoteOn(note, 0.95);
    noteToEl.get(note)?.classList.add('pressed');
  }
  function release(note: number) {
    onNoteOff(note);
    noteToEl.get(note)?.classList.remove('pressed');
  }

  for (const [note, el] of noteToEl) {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      activePointerNote = note;
      press(note);
    });
    el.addEventListener('mouseenter', () => {
      if (mouseIsDown && activePointerNote !== null && activePointerNote !== note) {
        release(activePointerNote);
        activePointerNote = note;
        press(note);
      }
    });
    el.addEventListener('mouseup', () => {
      if (activePointerNote === note) {
        release(note);
        activePointerNote = null;
      }
    });
    el.addEventListener('mouseleave', () => {
      /* handled via mouseenter drag / global mouseup */
    });
    el.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        press(note);
      },
      { passive: false }
    );
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      release(note);
    });
  }

  window.addEventListener('mouseup', () => {
    if (activePointerNote !== null) {
      release(activePointerNote);
      activePointerNote = null;
    }
  });

  container.appendChild(kb);

  return {
    setOctaveIndicator: () => {},
    highlightNote: (note, on) => {
      const el = noteToEl.get(note);
      if (el) el.classList.toggle('pressed', on);
    },
  };
}
