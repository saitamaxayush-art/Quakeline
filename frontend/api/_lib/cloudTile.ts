/**
 * Cloud tile proxy. Shared by the Vercel function (api/clouds/[z]/[x]/[y].ts) and the Vite
 * dev and preview middleware (vite.config.ts), so local and deployed behaviour are the same.
 *
 * The OpenWeatherMap key is read from the server environment only. It is never written to a
 * response, a header or a log line. Files in api/ that start with "_" are not deployed as
 * functions by Vercel, so this module is only reachable through the route above.
 */

/** Zoom levels the site uses. Keeping the range small means the proxy can only ever serve
 *  85 distinct images (1 + 4 + 16 + 64), each cached for 10 minutes, so it is no use as a
 *  general-purpose OpenWeatherMap key. */
export const MAX_ZOOM = 3

export interface CloudEnv {
  OWM_API_KEY?: string
  /** Extra allowed origins, comma separated, for example "https://quakeline.example". */
  ALLOWED_ORIGINS?: string
  /** Set by Vercel. */
  VERCEL_ENV?: string
  VERCEL_URL?: string
  VERCEL_BRANCH_URL?: string
  VERCEL_PROJECT_PRODUCTION_URL?: string
}

export type CloudErrorCode =
  | 'method_not_allowed'
  | 'bad_tile'
  | 'forbidden_origin'
  | 'missing_key'
  | 'invalid_key'
  | 'rate_limited'
  | 'upstream'
  | 'timeout'

const MESSAGES: Record<CloudErrorCode, string> = {
  method_not_allowed: 'Only GET is supported.',
  bad_tile: 'Tile coordinates must be integers: z from 0 to 3, x and y from 0 to 2^z - 1.',
  forbidden_origin: 'This tile proxy only serves pages on this site.',
  missing_key: 'The server has no OpenWeatherMap API key. See the README, section "Cloud layer API key".',
  invalid_key: 'OpenWeatherMap rejected the API key. New keys can take up to two hours to activate.',
  rate_limited: 'OpenWeatherMap rate limit reached. Try again in a few minutes.',
  upstream: 'OpenWeatherMap did not return a tile.',
  timeout: 'OpenWeatherMap did not answer in time.',
}

const STATUS: Record<CloudErrorCode, number> = {
  method_not_allowed: 405,
  bad_tile: 400,
  forbidden_origin: 403,
  missing_key: 503,
  invalid_key: 502,
  rate_limited: 429,
  upstream: 502,
  timeout: 504,
}

function errorResponse(code: CloudErrorCode) {
  return new Response(JSON.stringify({ error: code, message: MESSAGES[code] }), {
    status: STATUS[code],
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/** Parses "z/x/y" (an optional ".png" on y is accepted). Returns null unless all three are in range. */
export function parseTile(parts: string[]): { z: number; x: number; y: number } | null {
  if (parts.length !== 3) return null
  const [zs, xs, ys] = [parts[0], parts[1], parts[2].replace(/\.png$/, '')]
  if (![zs, xs, ys].every((s) => /^\d{1,2}$/.test(s))) return null
  const z = Number(zs)
  const x = Number(xs)
  const y = Number(ys)
  if (z > MAX_ZOOM) return null
  const n = 2 ** z
  if (x >= n || y >= n) return null
  return { z, x, y }
}

function allowedOrigins(env: CloudEnv, selfOrigin: string) {
  const set = new Set<string>([selfOrigin])
  for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (host) set.add(`https://${host}`)
  }
  for (const o of (env.ALLOWED_ORIGINS ?? '').split(',')) {
    const t = o.trim().replace(/\/$/, '')
    if (t) set.add(t)
  }
  // Local development and `vite preview`. Not accepted on a production deployment.
  if (env.VERCEL_ENV !== 'production') {
    for (const port of [5173, 4173, 3000]) {
      set.add(`http://localhost:${port}`)
      set.add(`http://127.0.0.1:${port}`)
    }
  }
  return set
}

/**
 * Browsers always say where a request comes from: cross-origin requests carry Origin, and
 * same-origin requests carry Sec-Fetch-Site and a Referer. A page on another site cannot
 * fake these, so it cannot use this proxy from its visitors' browsers. A script outside a
 * browser can send any header it likes; the small zoom range and the cache are what limit
 * that case (see MAX_ZOOM).
 */
export function originAllowed(request: Request, env: CloudEnv) {
  const self = new URL(request.url).origin
  const allowed = allowedOrigins(env, self)
  const origin = request.headers.get('origin')
  if (origin) return allowed.has(origin)
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      return allowed.has(new URL(referer).origin)
    } catch {
      return false
    }
  }
  return request.headers.get('sec-fetch-site') === 'same-origin'
}

export interface HandleOptions {
  /** Injected in tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export async function handleCloudTile(request: Request, env: CloudEnv, opts: HandleOptions = {}): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return errorResponse('method_not_allowed')

  const path = new URL(request.url).pathname
  const m = path.match(/\/api\/clouds\/(.+)$/)
  const tile = m ? parseTile(m[1].split('/')) : null
  if (!tile) return errorResponse('bad_tile')

  if (!originAllowed(request, env)) return errorResponse('forbidden_origin')

  const key = (env.OWM_API_KEY ?? '').trim()
  if (!key) return errorResponse('missing_key')

  const url = `https://tile.openweathermap.org/map/clouds_new/${tile.z}/${tile.x}/${tile.y}.png?appid=${encodeURIComponent(key)}`
  const doFetch = opts.fetchImpl ?? fetch
  let upstream: Response
  try {
    upstream = await doFetch(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? 8000) })
  } catch (err) {
    // The error object can contain the request URL, and with it the key. Never log or return it.
    const name = err instanceof Error ? err.name : ''
    return errorResponse(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'upstream')
  }

  if (upstream.status === 401 || upstream.status === 403) return errorResponse('invalid_key')
  if (upstream.status === 429) return errorResponse('rate_limited')
  const type = upstream.headers.get('content-type') ?? ''
  if (!upstream.ok || !type.startsWith('image/png')) return errorResponse('upstream')

  const body = await upstream.arrayBuffer()
  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=600',
      // Lets Vercel's CDN keep the tile for the same 10 minutes, so repeat requests never reach
      // OpenWeatherMap or spend the key.
      'Vercel-CDN-Cache-Control': 'max-age=600',
      // When this copy was fetched from OpenWeatherMap. The page labels the frame with it.
      'X-Tile-Fetched': new Date().toISOString(),
      'Access-Control-Expose-Headers': 'X-Tile-Fetched',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
