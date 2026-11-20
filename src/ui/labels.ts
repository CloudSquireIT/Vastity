// Etichette HTML sovrapposte alla scena 3D: pillole leggibili, toccabili, con anti-sovrapposizione.
export class LabelLayer<R = unknown> {
  el: HTMLDivElement;
  onPick: ((ref: R) => void) | null = null;
  private pool: HTMLDivElement[] = [];
  private refs: (R | undefined)[] = [];
  private used = 0;
  private boxes: number[] = [];

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'labels';
    parent.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('.label') as HTMLDivElement | null;
      if (!t) return;
      const i = this.pool.indexOf(t);
      const ref = this.refs[i];
      if (ref !== undefined && this.onPick) { e.stopPropagation(); this.onPick(ref); }
    });
  }

  begin() {
    this.used = 0;
    this.boxes.length = 0;
  }

  /** Aggiunge un'etichetta vicino al punto (x, y); restituisce false se si sovrappone a un'altra. */
  add(x: number, y: number, text: string, cls = '', force = false, ref?: R, radiusPx = 0): boolean {
    const w = text.length * 6.6 + 22, h = 24;
    // oggetti grandi sullo schermo: etichetta centrata sotto il disco, così non copre il render
    const under = radiusPx > 10;
    if (under) { y = y + radiusPx + 6; }
    const bx = under ? x - w / 2 : x + 10, by = under ? y : y - 2;
    if (!force) {
      for (let i = 0; i < this.boxes.length; i += 4) {
        if (bx < this.boxes[i + 2] && bx + w > this.boxes[i] && by < this.boxes[i + 3] && by + h > this.boxes[i + 1]) return false;
      }
    }
    this.boxes.push(bx, by, bx + w, by + h);
    let d = this.pool[this.used];
    if (!d) {
      d = document.createElement('div');
      this.el.appendChild(d);
      this.pool.push(d);
    }
    this.refs[this.used] = ref;
    this.used++;
    if (d.textContent !== text) d.textContent = text;
    const c = 'label ' + cls + (ref !== undefined ? ' tap' : '') + (under ? ' under' : '');
    if (d.className !== c) d.className = c;
    d.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)` + (under ? ' translateX(-50%)' : '');
    if (d.style.display) d.style.display = '';
    return true;
  }

  end() {
    for (let i = this.used; i < this.pool.length; i++) {
      if (this.pool[i].style.display !== 'none') this.pool[i].style.display = 'none';
      this.refs[i] = undefined;
    }
  }

  clear() { this.begin(); this.end(); }
}
