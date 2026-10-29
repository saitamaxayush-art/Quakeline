import { Vector3 } from 'three'

export { angleDelta, clamp01, range, smooth, lerp } from './frame'

const D2R = Math.PI / 180

/**
 * Position on a unit sphere that matches three's SphereGeometry UV layout
 * with an equirectangular texture (u = 0 at 180°W).
 */
export function latLonToVec3(lat: number, lon: number, r = 1, out = new Vector3()) {
  const la = lat * D2R
  const lo = lon * D2R
  return out.set(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r)
}

/** Euler angles (order XYZ) that turn the globe so lat/lon faces the camera on +Z. */
export function faceAngles(lat: number, lon: number) {
  return { x: lat * D2R, y: -Math.PI / 2 - lon * D2R }
}

