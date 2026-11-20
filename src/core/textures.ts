// Caricamento progressivo delle texture: prima una versione leggera, poi quella definitiva.
// Fonte: Solar System Scope (CC BY 4.0), basate su dati NASA.
import * as THREE from 'three';
import { quality } from './quality';

const HI_RES = new Set(['earth', 'moon', 'mars', 'jupiter', 'milkyway']);
const cache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
// decodifica delle immagini fuori dal thread principale (niente scatti mentre arrivano le texture)
const bitmapOK = typeof createImageBitmap === 'function';
const bitmapLoader = new THREE.ImageBitmapLoader();
bitmapLoader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });

function loadImage(url: string, onLoad: (img: any, isBitmap: boolean) => void) {
  if (bitmapOK) bitmapLoader.load(url, (b) => onLoad(b, true), undefined, () => loader.load(url, (t) => onLoad(t.image, false)));
  else loader.load(url, (t) => onLoad(t.image, false));
}
let maxAniso = 4;

export function initTextures(renderer: THREE.WebGLRenderer) {
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
}

function folderFor(name: string) {
  if (quality.tex === '4k' && HI_RES.has(name)) return '4k';
  return quality.tex === '1k' ? '1k' : '2k';
}

/**
 * Restituisce subito una texture (inizialmente vuota) che si riempie appena le
 * immagini arrivano. `color` = true per le mappe di colore (spazio sRGB).
 */
export function planetTexture(name: string, color = true): THREE.Texture {
  const key = name + (color ? '' : ':data');
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = new THREE.Texture();
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = maxAniso;
  tex.wrapS = THREE.RepeatWrapping;
  tex.userData.ready = false;
  cache.set(key, tex);
  const final = folderFor(name);
  const apply = (img: any, isBitmap: boolean) => {
    tex.image = img;
    tex.flipY = !isBitmap; // le ImageBitmap arrivano già capovolte
    tex.needsUpdate = true;
    tex.userData.ready = true;
  };
  if (final !== '1k') {
    loadImage(`textures/1k/${name}.webp`, (img, b) => { if (!tex.userData.final) apply(img, b); });
  }
  loadImage(`textures/${final}/${name}.webp`, (img, b) => { tex.userData.final = true; apply(img, b); });
  return tex;
}

export function ringTexture(): THREE.Texture {
  const hit = cache.get('ring');
  if (hit) return hit;
  const tex = loader.load('textures/saturn_ring.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  cache.set('ring', tex);
  return tex;
}

/** Texture 1×1 nera usata quando un corpo non ha immagini. */
export const blankTexture = (() => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();
