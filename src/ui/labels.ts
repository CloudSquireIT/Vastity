// Etichette HTML sovrapposte alla scena 3D, con riutilizzo dei nodi e anti-sovrapposizione.
export class LabelLayer {
  el: HTMLDivElement;
  private pool: HTMLDivElement[] = [];
  private used = 0;
  private grid = new Set<string>();

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'labels';
    parent.appendChild(this.el);
  }

  begin() {
    this.used = 0;
    this.grid.clear();
  }

  /** Aggiunge un'etichetta; restituisce false se scartata per sovrapposizione. */
  add(x: number, y: number, text: string, cls = '', force = false): boolean {
    const cx = Math.floor(x / 80), cy = Math.floor(y / 20);
    const k = `${cx},${cy}`;
    if (!force && (this.grid.has(k) || this.grid.has(`${cx + 1},${cy}`) || this.grid.has(`${cx - 1},${cy}`))) return false;
    this.grid.add(k);
    let d = this.pool[this.used];
    if (!d) {
      d = document.createElement('div');
      this.el.appendChild(d);
      this.pool.push(d);
    }
    this.used++;
    if (d.textContent !== text) d.textContent = text;
    const c = 'label ' + cls;
    if (d.className !== c) d.className = c;
    d.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    d.style.display = '';
    return true;
  }

  end() {
    for (let i = this.used; i < this.pool.length; i++) this.pool[i].style.display = 'none';
  }

  clear() { this.begin(); this.end(); }
}
