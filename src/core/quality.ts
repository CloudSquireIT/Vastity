// Qualità grafica in base al dispositivo e risoluzione adattiva per restare fluidi
// anche sugli schermi a 120 Hz.
import * as THREE from 'three';

export type Tier = 'low' | 'mid' | 'high';

export interface Quality {
  tier: Tier;
  /** Cartella delle texture preferita. */
  tex: '1k' | '2k' | '4k';
  maxDpr: number;
  galaxyParticles: number;
  dustParticles: number;
  sphereSegments: number;
  streaks: number;
}

function detectTier(): Tier {
  const nav = navigator as any;
  const mobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  const mem: number = nav.deviceMemory ?? 8;
  const cores: number = navigator.hardwareConcurrency ?? 4;
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch { /* */ }
  const weakGpu = /Mali-[GT]?[4-7]\d|Adreno \(TM\) [3-5]\d\d|PowerVR|SwiftShader|llvmpipe/i.test(gpu);
  if (weakGpu || mem <= 3 || cores <= 4) return 'low';
  if (!mobile && cores >= 8) return 'high';
  return 'mid';
}

const TIERS: Record<Tier, Omit<Quality, 'tier'>> = {
  low: { tex: '1k', maxDpr: 1.5, galaxyParticles: 40000, dustParticles: 9000, sphereSegments: 64, streaks: 1500 },
  mid: { tex: '2k', maxDpr: 2, galaxyParticles: 70000, dustParticles: 16000, sphereSegments: 96, streaks: 3000 },
  high: { tex: '4k', maxDpr: 2, galaxyParticles: 110000, dustParticles: 26000, sphereSegments: 128, streaks: 5000 },
};

const tier = detectTier();
export const quality: Quality = { tier, ...TIERS[tier] };

/**
 * Risoluzione adattiva: misura il tempo medio dei fotogrammi e abbassa o alza la
 * densità di pixel per restare vicini alla frequenza dello schermo (60/90/120 Hz).
 */
export class AdaptiveResolution {
  scale: number;
  private acc = 0;
  private frames = 0;
  private minDelta = 1 / 60;
  private cooldown = 2;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.scale = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
    renderer.setPixelRatio(this.scale);
  }

  /** Frequenza stimata dello schermo in Hz. */
  get refresh() { return Math.round(1 / this.minDelta); }

  update(dt: number) {
    if (dt <= 0 || dt > 0.25) return;
    this.minDelta = Math.min(this.minDelta * 1.0005, Math.max(1 / 144, dt));
    this.acc += dt;
    this.frames++;
    this.cooldown -= dt;
    if (this.acc < 1.5) return;
    const avg = this.acc / this.frames;
    this.acc = 0;
    this.frames = 0;
    if (this.cooldown > 0) return;
    const budget = this.minDelta;
    const maxS = Math.min(window.devicePixelRatio || 1, quality.maxDpr);
    let next = this.scale;
    if (avg > budget * 1.35) next = Math.max(0.75, this.scale * 0.85);
    else if (avg < budget * 1.08 && this.scale < maxS) next = Math.min(maxS, this.scale * 1.1);
    if (Math.abs(next - this.scale) > 0.02) {
      this.scale = next;
      this.renderer.setPixelRatio(next);
      this.cooldown = 3;
    }
  }
}
