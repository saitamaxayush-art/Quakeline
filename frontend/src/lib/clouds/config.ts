/**
 * Satellite cloud imagery: sources and sizes. Shared by the worker and the page.
 *
 * Past frames: NASA GIBS WMTS, geostationary infrared (ABI / AHI band 13, 10.3 µm) from three
 * satellites, one frame per hour, chosen from the times GIBS actually lists (DescribeDomains).
 * Current frame: OpenWeatherMap "clouds_new", through this site's /api/clouds proxy so the key
 * stays on the server. Both are Web Mercator XYZ tiles on the same grid.
 */

/** Tile zoom for every source: 2 x 2 tiles of 256 px, a 512 px Mercator world. */
export const TILE_Z = 1
export const TILE_N = 2 ** TILE_Z
export const MERC = 256 * TILE_N

/** Equirectangular frame the globe samples (single channel: cover 0 to 255). */
export const EQ_W = 1024
export const EQ_H = 512

/** Hourly past frames to show before the current one. */
export const PAST_FRAMES = 8

export const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
export const GIBS_MATRIX = 'GoogleMapsCompatible_Level6'

export interface GibsLayer {
  id: string
  /** Short name used in labels. */
  name: string
  /** Longitude of the point below the satellite, in degrees. */
  subLon: number
}

export const GIBS_LAYERS: GibsLayer[] = [
  { id: 'GOES-East_ABI_Band13_Clean_Infrared', name: 'GOES-East', subLon: -75.2 },
  { id: 'GOES-West_ABI_Band13_Clean_Infrared', name: 'GOES-West', subLon: -137.2 },
  { id: 'Himawari_AHI_Band13_Clean_Infrared', name: 'Himawari', subLon: 140.7 },
]

export interface FrameMeta {
  index: number
  kind: 'gibs' | 'owm'
  /** Observation time (GIBS) in ms. For OpenWeatherMap the time is not published; the label
   *  uses the moment our proxy fetched the tile instead. */
  time: number | null
  /** Satellites that contribute to a GIBS frame. */
  layers: string[]
}

export type FrameErrorCode =
  | 'missing_key'
  | 'invalid_key'
  | 'rate_limited'
  | 'forbidden_origin'
  | 'upstream'
  | 'offline'
  | 'gibs'
  | 'unsupported'

export type WorkerIn = { type: 'start'; now: number }

export type WorkerOut =
  | { type: 'plan'; frames: FrameMeta[]; gibsOk: boolean }
  | { type: 'frame'; index: number; eq: Uint8Array; coverage: number; fetchedAt: number | null }
  | { type: 'frameError'; index: number; code: FrameErrorCode }
