// Tests the cloud tile proxy without a server: `node scripts/test-proxy.ts` (Node 23+).
// Live checks read OWM_API_KEY from the environment or .env.local. The key is never printed:
// every response body and header is searched for it, and the test fails if it appears.
import { readFileSync } from 'node:fs'
import { handleCloudTile, type CloudEnv } from '../api/_lib/cloudTile.ts'

function keyFromEnvFile(): string {
  if (process.env.OWM_API_KEY) return process.env.OWM_API_KEY
  try {
    const line = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('OWM_API_KEY='))
    return line ? line.slice('OWM_API_KEY='.length).trim() : ''
  } catch {
    return ''
  }
}

const REAL_KEY = keyFromEnvFile()
const FAKE_KEY = '0123456789abcdef0123456789abcdef'
const SITE = 'https://quakeline.example'
let failed = 0
let passed = 0

async function leaks(res: Response, secret: string) {
  if (!secret) return false
  const text = Buffer.from(await res.clone().arrayBuffer()).toString('latin1')
  let headers = ''
  res.headers.forEach((v, k) => (headers += `${k}:${v}\n`))
  return text.includes(secret) || headers.includes(secret)
}

async function check(
  name: string,
  req: { path: string; headers?: Record<string, string>; method?: string },
  env: CloudEnv,
  expect: { status: number; error?: string; type?: string },
  fetchImpl?: typeof fetch,
) {
  const request = new Request(`${SITE}${req.path}`, { method: req.method ?? 'GET', headers: req.headers })
  const res = await handleCloudTile(request, env, { fetchImpl })
  const problems: string[] = []
  if (res.status !== expect.status) problems.push(`status ${res.status}, expected ${expect.status}`)
  if (expect.error) {
    const body = (await res.clone().json()) as { error?: string }
    if (body.error !== expect.error) problems.push(`error "${body.error}", expected "${expect.error}"`)
  }
  if (expect.type && !(res.headers.get('content-type') ?? '').startsWith(expect.type))
    problems.push(`content-type ${res.headers.get('content-type')}`)
  if (res.status === 200 && res.headers.get('cache-control') !== 'public, max-age=600')
    problems.push(`cache-control ${res.headers.get('cache-control')}`)
  if ((await leaks(res, REAL_KEY)) || (await leaks(res, FAKE_KEY))) problems.push('KEY FOUND IN RESPONSE')
  if (problems.length) {
    failed++
    console.log(`FAIL  ${name}: ${problems.join('; ')}`)
  } else {
    passed++
    console.log(`ok    ${name} (${res.status}${expect.error ? ` ${expect.error}` : ''})`)
  }
}

const same = { 'sec-fetch-site': 'same-origin', referer: `${SITE}/explore` }
const withFake: CloudEnv = { OWM_API_KEY: FAKE_KEY }
const mock =
  (status: number, type = 'image/png'): typeof fetch =>
  async () =>
    new Response(status === 200 ? new Uint8Array([137, 80, 78, 71]) : 'x', { status, headers: { 'content-type': type } })
const throwing =
  (name: string): typeof fetch =>
  async () => {
    const e = new Error(`request to https://tile.openweathermap.org/...appid=${FAKE_KEY} failed`)
    e.name = name
    throw e
  }

console.log('Validation')
await check('zoom above 3', { path: '/api/clouds/4/0/0', headers: same }, withFake, { status: 400, error: 'bad_tile' })
await check('x out of range', { path: '/api/clouds/1/2/0', headers: same }, withFake, { status: 400, error: 'bad_tile' })
await check('negative y', { path: '/api/clouds/1/0/-1', headers: same }, withFake, { status: 400, error: 'bad_tile' })
await check('not a number', { path: '/api/clouds/a/b/c', headers: same }, withFake, { status: 400, error: 'bad_tile' })
await check('decimal', { path: '/api/clouds/1.5/0/0', headers: same }, withFake, { status: 400, error: 'bad_tile' })
await check('too few parts', { path: '/api/clouds/1/0', headers: same }, withFake, { status: 400, error: 'bad_tile' })
await check('POST', { path: '/api/clouds/1/0/0', headers: same, method: 'POST' }, withFake, { status: 405 })

console.log('Origin')
await check('no browser headers (curl)', { path: '/api/clouds/1/0/0' }, withFake, { status: 403, error: 'forbidden_origin' })
await check('other site Origin', { path: '/api/clouds/1/0/0', headers: { origin: 'https://evil.example' } }, withFake, {
  status: 403,
  error: 'forbidden_origin',
})
await check('other site Referer', { path: '/api/clouds/1/0/0', headers: { referer: 'https://evil.example/x' } }, withFake, {
  status: 403,
  error: 'forbidden_origin',
})
await check(
  'localhost refused in production',
  { path: '/api/clouds/1/0/0', headers: { origin: 'http://localhost:5173' } },
  { ...withFake, VERCEL_ENV: 'production' },
  { status: 403, error: 'forbidden_origin' },
)
await check(
  'ALLOWED_ORIGINS accepted',
  { path: '/api/clouds/1/0/0', headers: { origin: 'https://my.domain' } },
  { ...withFake, ALLOWED_ORIGINS: 'https://my.domain/' },
  { status: 200, type: 'image/png' },
  mock(200),
)

console.log('Without a key')
await check('key missing', { path: '/api/clouds/1/0/0', headers: same }, {}, { status: 503, error: 'missing_key' })
await check('key blank', { path: '/api/clouds/1/0/0', headers: same }, { OWM_API_KEY: '   ' }, { status: 503, error: 'missing_key' })

console.log('Upstream errors (mocked)')
await check('upstream 401', { path: '/api/clouds/1/0/0', headers: same }, withFake, { status: 502, error: 'invalid_key' }, mock(401))
await check('upstream 429', { path: '/api/clouds/1/0/0', headers: same }, withFake, { status: 429, error: 'rate_limited' }, mock(429))
await check('upstream 500', { path: '/api/clouds/1/0/0', headers: same }, withFake, { status: 502, error: 'upstream' }, mock(500))
await check('upstream HTML', { path: '/api/clouds/1/0/0', headers: same }, withFake, { status: 502, error: 'upstream' }, mock(200, 'text/html'))
await check('timeout, message holds key', { path: '/api/clouds/1/0/0', headers: same }, withFake, { status: 504, error: 'timeout' }, throwing('TimeoutError'))
await check('network error, message holds key', { path: '/api/clouds/1/0/0', headers: same }, withFake, { status: 502, error: 'upstream' }, throwing('TypeError'))

console.log('Live OpenWeatherMap')
await check('invalid key', { path: '/api/clouds/1/0/0', headers: same }, withFake, { status: 502, error: 'invalid_key' })
if (REAL_KEY) {
  await check('real key, tile 1/0/0', { path: '/api/clouds/1/0/0', headers: same }, { OWM_API_KEY: REAL_KEY }, { status: 200, type: 'image/png' })
  await check('real key, tile 0/0/0.png', { path: '/api/clouds/0/0/0.png', headers: same }, { OWM_API_KEY: REAL_KEY }, { status: 200, type: 'image/png' })
} else {
  console.log('skip  real key checks: OWM_API_KEY is not set')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
