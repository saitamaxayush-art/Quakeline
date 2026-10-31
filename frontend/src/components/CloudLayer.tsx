import { Pause, Play, RotateCw } from 'lucide-react'
import { Button, Check } from './ui'
import type { FrameErrorCode } from '../lib/clouds/config'
import { useTimelinePos, useTimelineSnapshot, type CloudTimeline, type FrameState } from '../lib/clouds/timeline'

const clockFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
const clock = (t: number) => clockFmt.format(t)
const utcFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

function relHours(t: number, now: number) {
  const h = Math.round((now - t) / 3600e3)
  return h <= 0 ? 'under 1 h ago' : `${h} h ago`
}

/** Short label under the scrubber. */
function tickLabel(f: FrameState) {
  return f.kind === 'owm' ? 'Now' : f.time !== null ? clock(f.time) : ''
}

/** Time and source of a frame, in full. */
function describe(f: FrameState, now: number) {
  if (f.kind === 'owm') {
    const when = f.fetchedAt ? `fetched ${clock(f.fetchedAt)}` : 'latest'
    return { time: 'Now', ago: when, source: 'OpenWeatherMap, current cloud cover' }
  }
  return {
    time: f.time !== null ? clock(f.time) : '',
    ago: f.time !== null ? relHours(f.time, now) : '',
    source: `NASA GIBS, infrared (10.3 µm) from ${f.layers.join(', ')}`,
  }
}

/** The label printed on the globe: "Clouds, 31 Oct 2026 08:30 UTC, NASA GIBS infrared". */
export function globeLabel(f: FrameState) {
  if (f.kind === 'owm') {
    const t = f.fetchedAt ? `${utcFmt.format(f.fetchedAt).replace(',', '')} UTC` : 'latest'
    return { time: t, source: 'OpenWeatherMap, fetched then' }
  }
  return {
    time: f.time !== null ? `${utcFmt.format(f.time).replace(',', '')} UTC` : '',
    source: `NASA GIBS infrared, ${f.layers.join(', ')}`,
  }
}

const KEY_MESSAGES: Partial<Record<FrameErrorCode, string>> = {
  missing_key: 'Cloud layer needs an API key, see README.',
  invalid_key: 'OpenWeatherMap rejected the API key. New keys can take up to 2 hours to activate. See README.',
  rate_limited: 'OpenWeatherMap rate limit reached. The current frame will be back in a few minutes.',
  forbidden_origin: 'The cloud proxy refused this address. Add it to ALLOWED_ORIGINS, see README.',
}

function nowFrameMessage(code: FrameErrorCode | undefined) {
  if (!code) return null
  return KEY_MESSAGES[code] ?? 'The current frame from OpenWeatherMap did not load.'
}

export function CloudPanel({
  tl,
  on,
  onToggle,
  opacity,
  onOpacity,
  dim,
  onDim,
}: {
  tl: CloudTimeline
  on: boolean
  onToggle: (v: boolean) => void
  /** 0.2 to 1. */
  opacity: number
  onOpacity: (v: number) => void
  dim: boolean
  onDim: (v: boolean) => void
}) {
  const snap = useTimelineSnapshot(tl)
  const pos = useTimelinePos(tl)
  const { frames, phase } = snap
  const n = frames.length
  const ready = frames.filter((f) => f.status === 'ready').length
  const done = frames.filter((f) => f.status !== 'loading').length
  const current = snap.index >= 0 ? frames[snap.index] : undefined
  const nowFrame = frames.find((f) => f.kind === 'owm')
  const keyMsg = nowFrame?.status === 'error' ? nowFrameMessage(nowFrame.error) : null
  const allFailed = phase === 'running' && n > 0 && frames.every((f) => f.status === 'error')
  const offlineFailed = frames.some((f) => f.status === 'error' && f.error === 'offline')
  const unsupported = frames.some((f) => f.error === 'unsupported')
  const loading = phase === 'planning' || (phase === 'running' && done < n)
  const info = current ? describe(current, Date.now()) : null
  const hasGap = current?.kind === 'gibs' && (current.coverage ?? 1) < 0.97

  return (
    <div className={`cloud-bar ${on ? 'is-on' : ''}`} role="group" aria-labelledby="cloud-title">
      <div className="cloud-top">
        <div className="cloud-head">
          <h3 id="cloud-title" className="cloud-title">
            Satellite cloud imagery
          </h3>
          <Check checked={on} onChange={onToggle} hint="Past hours from NASA GIBS, the current hour from OpenWeatherMap">
            Show clouds
          </Check>
        </div>
        {on && info && (
          <p className="cloud-meta" aria-live="polite">
            <strong className="mono">{info.time}</strong>
            <span>{info.ago}</span>
            <span className="cloud-source">{info.source}</span>
          </p>
        )}
      </div>

      {on && (
        <>
          {phase === 'offline' ? (
            <p className="cloud-msg is-warn" role="status">
              You are offline. Satellite imagery needs a connection; the earthquake data already loaded stays available.
            </p>
          ) : unsupported ? (
            <p className="cloud-msg is-warn" role="status">
              This browser cannot draw the cloud layer (it needs Web Workers and OffscreenCanvas). Everything else works.
            </p>
          ) : allFailed ? (
            <div className="cloud-msg is-error" role="alert">
              <span>
                {keyMsg && !snap.gibsOk
                  ? `${keyMsg} NASA GIBS did not respond either.`
                  : offlineFailed
                    ? 'The connection dropped while loading satellite imagery.'
                    : 'Satellite imagery could not be loaded from NASA GIBS or OpenWeatherMap.'}
              </span>
              <Button variant="outline" size="sm" onClick={() => tl.retry()} icon={<RotateCw size={14} />}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              <div className="cloud-controls">
                <Button
                  variant="solid"
                  size="sm"
                  className="cloud-play"
                  onClick={() => tl.toggle()}
                  disabled={ready < 2}
                  aria-label={snap.playing ? 'Pause cloud timeline' : 'Play cloud timeline'}
                  icon={snap.playing ? <Pause size={15} /> : <Play size={15} />}
                >
                  {snap.playing ? 'Pause' : 'Play'}
                </Button>
                <div className="cloud-scrub">
                  <input
                    type="range"
                    className="range cloud-range"
                    min={0}
                    max={Math.max(1, n - 1)}
                    step={0.01}
                    value={pos}
                    disabled={ready < 1}
                    aria-label="Cloud imagery time"
                    aria-valuetext={info ? `${info.time}, ${info.ago}, ${info.source}` : 'Loading'}
                    style={{ ['--p' as string]: `${(pos / Math.max(1, n - 1)) * 100}%` }}
                    onChange={(e) => tl.seek(Number(e.target.value))}
                    onKeyDown={(e) => {
                      // Arrow keys step whole frames instead of hundredths.
                      if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                        e.preventDefault()
                        const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1
                        tl.seek(Math.round(pos) + d)
                      }
                    }}
                  />
                  <ol className="cloud-ticks" aria-hidden="true">
                    {frames.map((f, i) => (
                      <li
                        key={i}
                        className={`is-${f.status} ${i === snap.index ? 'is-current' : ''}`}
                        style={{ left: `${(i / Math.max(1, n - 1)) * 100}%` }}
                      >
                        {(i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2)) && <span>{tickLabel(f)}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {loading && (
                <div className="cloud-msg" role="status">
                  <span>{phase === 'planning' ? 'Finding the latest satellite frames' : `Loading frame ${Math.min(done + 1, n)} of ${n}`}</span>
                  <span className="cloud-progress" aria-hidden="true">
                    <i style={{ transform: `scaleX(${n ? done / n : 0.05})` }} />
                  </span>
                </div>
              )}
              {snap.waiting && !loading && <p className="cloud-msg">Waiting for the next frame.</p>}
              {keyMsg && (
                <p className="cloud-msg is-warn" role="status">
                  {keyMsg} {snap.gibsOk ? 'The past frames from NASA GIBS still play.' : ''}
                </p>
              )}
              {!snap.gibsOk && !keyMsg && phase === 'running' && (
                <div className="cloud-msg is-warn" role="status">
                  <span>NASA GIBS did not respond, so only the current frame is shown.</span>
                  <Button variant="ghost" size="sm" onClick={() => tl.retry()} icon={<RotateCw size={14} />}>
                    Try again
                  </Button>
                </div>
              )}
            </>
          )}

          <div className="cloud-settings">
            <label className="cloud-opacity">
              <span className="field-label">Cloud opacity</span>
              <input
                type="range"
                className="range"
                min={0.2}
                max={1}
                step={0.05}
                value={opacity}
                style={{ ['--p' as string]: `${((opacity - 0.2) / 0.8) * 100}%` }}
                onChange={(e) => onOpacity(Number(e.target.value))}
              />
              <output className="mono">{Math.round(opacity * 100)}%</output>
            </label>
            <Check checked={dim} onChange={onDim} hint="Fainter clouds, so earthquakes stand out where cover is dense">
              Dim clouds
            </Check>
          </div>
          <p className="cloud-note">
            Shown for geographic context only. Clouds and weather do not cause or predict earthquakes.
            {hasGap && ' Past frames: GIBS publishes no Meteosat imagery, so Europe, Africa and the Indian Ocean have no clouds in them.'}
          </p>
        </>
      )}
    </div>
  )
}
