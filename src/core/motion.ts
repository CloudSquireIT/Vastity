// Primitive di movimento: smorzamento indipendente dal frame rate e molle critiche.
// Tutto è espresso in secondi, quindi a 60 o 120 Hz il movimento è identico.

/** Avvicina `current` a `target` con costante `lambda` (1/s). */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/** Come damp ma per angoli in radianti (percorso più breve). */
export function dampAngle(current: number, target: number, lambda: number, dt: number) {
  let d = target - current;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return current + d * (1 - Math.exp(-lambda * dt));
}

/** Molla critica (senza rimbalzi) con velocità: movimento organico, mai a scatti. */
export class SmoothValue {
  velocity = 0;
  constructor(public value: number, public smoothTime = 0.25) {}
  to(target: number, dt: number, maxSpeed = Infinity) {
    // Game Programming Gems 4, "Critically Damped Ease-In/Ease-Out Smoothing"
    const omega = 2 / Math.max(1e-4, this.smoothTime);
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    let change = this.value - target;
    const maxChange = maxSpeed * this.smoothTime;
    change = Math.max(-maxChange, Math.min(maxChange, change));
    const t = this.value - change;
    const temp = (this.velocity + omega * change) * dt;
    this.velocity = (this.velocity - omega * temp) * exp;
    let out = t + (change + temp) * exp;
    if ((target - this.value > 0) === (out > target)) { out = target; this.velocity = (out - target) / Math.max(dt, 1e-6); }
    this.value = out;
    return out;
  }
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
