export interface KnobOptions {
  label: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  bipolar?: boolean;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

export function createKnob(opts: KnobOptions): HTMLElement {
  const { min, max, step = (max - min) / 100 } = opts;
  let value = opts.value;

  const wrap = document.createElement('div');
  wrap.className = 'knob-wrap';

  const dial = document.createElement('div');
  dial.className = 'knob-dial';
  const indicator = document.createElement('div');
  indicator.className = 'knob-indicator';
  dial.appendChild(indicator);
  if (opts.bipolar) {
    const center = document.createElement('div');
    center.className = 'knob-center-mark';
    dial.appendChild(center);
  }

  const label = document.createElement('div');
  label.className = 'knob-label';
  label.textContent = opts.label;

  const valueDisplay = document.createElement('div');
  valueDisplay.className = 'knob-value';

  function render() {
    const pct = (value - min) / (max - min);
    const angle = -135 + pct * 270;
    indicator.style.transform = `rotate(${angle}deg)`;
    valueDisplay.textContent = opts.format ? opts.format(value) : value.toFixed(2);
  }

  function setValue(v: number, notify: boolean) {
    value = Math.max(min, Math.min(max, v));
    render();
    if (notify) opts.onChange(value);
  }

  let dragStartY = 0;
  let dragStartVal = 0;
  let dragging = false;

  function pointerDown(clientY: number) {
    dragging = true;
    dragStartY = clientY;
    dragStartVal = value;
    dial.classList.add('active');
  }
  function pointerMove(clientY: number) {
    if (!dragging) return;
    const deltaPx = dragStartY - clientY;
    const range = max - min;
    const sensitivity = range / 150;
    let newVal = dragStartVal + deltaPx * sensitivity;
    newVal = Math.round(newVal / step) * step;
    setValue(newVal, true);
  }
  function pointerUp() {
    dragging = false;
    dial.classList.remove('active');
  }

  dial.addEventListener('mousedown', (e) => {
    e.preventDefault();
    pointerDown(e.clientY);
    const mm = (ev: MouseEvent) => pointerMove(ev.clientY);
    const mu = () => {
      pointerUp();
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
    };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  });
  dial.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      pointerDown(e.touches[0].clientY);
    },
    { passive: false }
  );
  dial.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      pointerMove(e.touches[0].clientY);
    },
    { passive: false }
  );
  dial.addEventListener('touchend', () => pointerUp());
  dial.addEventListener('dblclick', () => setValue(opts.value, true));
  dial.addEventListener('wheel', (e) => {
    e.preventDefault();
    setValue(value - Math.sign(e.deltaY) * step, true);
  });

  render();
  wrap.appendChild(dial);
  wrap.appendChild(label);
  wrap.appendChild(valueDisplay);

  (wrap as any).setKnobValue = (v: number) => setValue(v, false);
  return wrap;
}

export function createSelect(label: string, options: { value: string; text: string }[], current: string, onChange: (v: string) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'select-wrap';
  const lbl = document.createElement('div');
  lbl.className = 'select-label';
  lbl.textContent = label;
  const sel = document.createElement('select');
  for (const o of options) {
    const el = document.createElement('option');
    el.value = o.value;
    el.textContent = o.text;
    if (o.value === current) el.selected = true;
    sel.appendChild(el);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  wrap.appendChild(lbl);
  wrap.appendChild(sel);
  return wrap;
}

export function createToggle(label: string, current: boolean, onChange: (v: boolean) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'toggle-wrap';
  const btn = document.createElement('button');
  btn.className = 'toggle-btn' + (current ? ' on' : '');
  btn.textContent = label;
  btn.addEventListener('click', () => {
    const next = !btn.classList.contains('on');
    btn.classList.toggle('on', next);
    onChange(next);
  });
  wrap.appendChild(btn);
  return wrap;
}

export function moduleBox(title: string, ...children: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.className = 'module-box';
  const header = document.createElement('div');
  header.className = 'module-header';
  header.textContent = title;
  box.appendChild(header);
  const body = document.createElement('div');
  body.className = 'module-body';
  for (const c of children) body.appendChild(c);
  box.appendChild(body);
  return box;
}
