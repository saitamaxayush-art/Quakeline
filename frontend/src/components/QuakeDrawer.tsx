import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, ExternalLink, Link2, Copy, Check as CheckIcon, Waves, MapPin } from 'lucide-react'
import type { Quake } from '../lib/types'
import { coord, depthLabel, distanceKm, km, localTime, mag, magWord, timeAgo, titleCase, utcTime } from '../lib/format'
import WorldMap from './WorldMap'
import { magClass } from '../lib/scales'
import { Button } from './ui'

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600)
    } catch {
      setCopied(null)
    }
  }
  return { copied, copy }
}

export default function QuakeDrawer({
  quake,
  all,
  now,
  onClose,
  onSelect,
}: {
  quake: Quake | null
  all: Quake[]
  now: number
  onClose: () => void
  onSelect: (q: Quake) => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const { copied, copy } = useCopy()
  const open = !!quake

  useEffect(() => {
    if (!open) return
    const lenis = window.__lenis
    lenis?.stop()
    document.documentElement.classList.add('lock')
    const t = setTimeout(() => closeRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      lenis?.start()
      document.documentElement.classList.remove('lock')
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [quake?.id])

  const nearby = useMemo(() => {
    if (!quake) return []
    return all
      .filter((q) => q.id !== quake.id)
      .map((q) => ({ q, d: distanceKm(quake.lat, quake.lon, q.lat, q.lon) }))
      .filter((x) => x.d <= 250)
      .sort((a, b) => a.d - b.d)
      .slice(0, 6)
  }, [quake, all])

  const stats: [string, string][] = quake
    ? [
        ['Depth', `${km(quake.depth)} (${depthLabel(quake.depth).toLowerCase()})`],
        ['Coordinates', coord(quake.lat, quake.lon)],
        ['Magnitude type', quake.magType ?? 'Not given'],
        ['Review status', titleCase(quake.status)],
        ['Event type', titleCase(quake.type)],
        ['Network', quake.net.toUpperCase()],
        ['Significance', `${quake.sig} of 1000`],
        ['Felt reports', quake.felt ? quake.felt.toLocaleString('en') : 'None yet'],
        ['Max intensity (MMI)', quake.mmi !== null ? quake.mmi.toFixed(1) : 'Not computed'],
        ['Stations used', quake.nst !== null ? String(quake.nst) : 'Not given'],
        ['Azimuthal gap', quake.gap !== null ? `${Math.round(quake.gap)}°` : 'Not given'],
        ['RMS residual', quake.rms !== null ? `${quake.rms.toFixed(2)} s` : 'Not given'],
      ]
    : []

  return (
    <AnimatePresence>
      {quake && (
        <>
          <motion.div
            className="scrim"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
          <motion.aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 36 }}
          >
            <div className="drawer-top">
              <span className="drawer-id">Event {quake.id}</span>
              <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close details">
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body" ref={bodyRef} data-lenis-prevent>
              <AnimatePresence mode="wait">
                <motion.div
                  key={quake.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="drawer-head">
                    <div className={`drawer-mag ${magClass(quake.mag)}`}>
                      <span>M</span>
                      {mag(quake.mag)}
                    </div>
                    <div>
                      <h2 id="drawer-title">{quake.place}</h2>
                      <p className="drawer-word">{magWord(quake.mag)}</p>
                    </div>
                  </div>

                  {quake.tsunami && (
                    <div className="notice">
                      <Waves size={18} aria-hidden="true" />
                      <p>
                        The tsunami flag is set for this event. That means it met criteria for checking, not that a tsunami
                        happened. For warnings, follow your national tsunami warning centre.
                      </p>
                    </div>
                  )}

                  <div className="drawer-times">
                    <div>
                      <span>Your time</span>
                      <strong>{localTime(quake.time)}</strong>
                    </div>
                    <div>
                      <span>UTC</span>
                      <strong>{utcTime(quake.time)}</strong>
                    </div>
                    <div>
                      <span>Age</span>
                      <strong>{timeAgo(quake.time, now)}</strong>
                    </div>
                  </div>

                  <div className="drawer-map">
                    <WorldMap quakes={[quake]} compact focus={quake} />
                  </div>

                  <dl className="facts">
                    {stats.map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="drawer-actions">
                    <a className="btn btn-solid btn-md" href={quake.url} target="_blank" rel="noreferrer">
                      <span className="btn-icon">
                        <ExternalLink size={16} />
                      </span>
                      <span>Full USGS record</span>
                    </a>
                    <Button
                      variant="outline"
                      icon={copied === 'link' ? <CheckIcon size={16} /> : <Link2 size={16} />}
                      onClick={() => copy('link', window.location.href)}
                    >
                      {copied === 'link' ? 'Link copied' : 'Copy link'}
                    </Button>
                    <Button
                      variant="ghost"
                      icon={copied === 'coord' ? <CheckIcon size={16} /> : <Copy size={16} />}
                      onClick={() => copy('coord', `${quake.lat}, ${quake.lon}`)}
                    >
                      {copied === 'coord' ? 'Copied' : 'Coordinates'}
                    </Button>
                  </div>

                  <section className="nearby">
                    <h3>
                      <MapPin size={16} aria-hidden="true" /> Within 250 km in this feed
                    </h3>
                    {nearby.length === 0 ? (
                      <p className="muted">No other events in the current window were recorded this close.</p>
                    ) : (
                      <ul>
                        {nearby.map(({ q, d }) => (
                          <li key={q.id}>
                            <button onClick={() => onSelect(q)}>
                              <span className={`mini-mag ${magClass(q.mag)}`}>{mag(q.mag)}</span>
                              <span className="nearby-place">{q.place}</span>
                              <span className="nearby-d">{Math.round(d)} km</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
