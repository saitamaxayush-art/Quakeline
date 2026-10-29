// Reusable engraved globe. Import lazily: it pulls in three.js.
export { default as Globe, type GlobeProps } from './Globe'
export { createGlobeFrame, type GlobeFrame } from './frame'
export { EngravingEffect, type EngravingOptions } from './EngravingEffect'
export { latLonToVec3, faceAngles } from './math'

/** Bundled NASA Blue Marble textures (public domain). */
export const EARTH_TEXTURE = { high: '/textures/earth-2048.webp', low: '/textures/earth-1024.webp' }
