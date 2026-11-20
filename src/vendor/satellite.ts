// Sottoinsieme di satellite.js senza la parte WebAssembly (vedi vite.config.ts).
// @ts-nocheck
export { twoline2satrec } from '@satellite/io.js';
export { propagate, gstime } from '@satellite/propagation.js';
export { radiansToDegrees, degreesToRadians, degreesLat, degreesLong, eciToGeodetic, eciToEcf, ecfToLookAngles } from '@satellite/transforms.js';
