import { PRESETS, CATEGORIES } from '../audio/presets';

export function buildPatchBrowser(container: HTMLElement, currentId: string, onSelect: (id: string) => void) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'patch-browser';

  for (const cat of CATEGORIES) {
    const section = document.createElement('div');
    section.className = 'patch-category';
    const title = document.createElement('div');
    title.className = 'patch-category-title';
    title.textContent = cat;
    section.appendChild(title);
    const list = document.createElement('div');
    list.className = 'patch-list';
    for (const p of PRESETS.filter((x) => x.category === cat)) {
      const btn = document.createElement('button');
      btn.className = 'patch-btn' + (p.id === currentId ? ' active' : '');
      btn.textContent = p.name;
      btn.addEventListener('click', () => onSelect(p.id));
      list.appendChild(btn);
    }
    section.appendChild(list);
    wrap.appendChild(section);
  }
  container.appendChild(wrap);
}
