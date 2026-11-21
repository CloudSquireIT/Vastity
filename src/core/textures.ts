// Caricamento progressivo delle texture: prima una versione leggera, poi quella definitiva.
// Fonte: Solar System Scope (CC BY 4.0), basate su dati NASA.
import * as THREE from 'three';
import { quality } from './quality';
import { texture4kUrl } from './remote';

// texture 4K (incluse nell'app): si caricano solo quando il corpo è grande sullo schermo, per la memoria
const HI_RES = new Set(['earth', 'earth_scl', 'moon', 'mars', 'mercury', 'jupiter', 'saturn', 'sun', 'venus', 'milkyway']);
const cache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();
// decodifica delle immagini fuori dal thread principale (niente scatti mentre arrivano le texture)
const bitmapOK = typeof createImageBitmap === 'function';
const bitmapLoader = new THREE.ImageBitmapLoader();
bitmapLoader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });

function loadImage(url: string, onLoad: (img: any, isBitmap: boolean) => void, onError?: () => void) {
  if (bitmapOK) bitmapLoader.load(url, (b) => onLoad(b, true), undefined, () => loader.load(url, (t) => onLoad(t.image, false), undefined, onError));
  else loader.load(url, (t) => onLoad(t.image, false), undefined, onError);
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
  const final = folderFor(name) === '4k' ? '2k' : folderFor(name);
  const apply = (img: any, isBitmap: boolean) => {
    tex.image = img;
    tex.flipY = !isBitmap; // le ImageBitmap arrivano già capovolte
    tex.needsUpdate = true;
    tex.userData.ready = true;
  };
  if (final !== '1k') {
    loadImage(`textures/1k/${name}.webp`, (img, b) => { if (!tex.userData.final) apply(img, b); });
  }
  const done = (img: any, b: boolean) => { if (!tex.userData.hi) { tex.userData.final = true; apply(img, b); } };
  loadImage(`textures/${final}/${name}.webp`, done);
  // il 4K resta in attesa: lo chiede `wantHiRes` quando il corpo si avvicina
  tex.userData.hiName = quality.tex === '4k' && HI_RES.has(name) ? name : '';
  return tex;
}

/** Carica la versione 4K di una texture (una volta sola), quando il corpo occupa molto schermo. */
export function wantHiRes(tex: THREE.Texture | null | undefined) {
  const name = tex?.userData?.hiName as string | undefined;
  if (!tex || !name || tex.userData.hiReq) return;
  tex.userData.hiReq = true;
  loadImage(texture4kUrl(name), (img, b) => {
    tex.userData.hi = true;
    tex.image = img;
    tex.flipY = !b;
    tex.needsUpdate = true;
  });
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
