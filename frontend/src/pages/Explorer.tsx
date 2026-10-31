import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, Globe as GlobeIcon, Search, SlidersHorizontal, RotateCw, X } from 'lucide-react'
import { useDebounced, useFeed, useFilters, useMedia, useNow, useOnline } from '../hooks'
import { applyFilters, countActive, DEPTHS, LEVELS, PERIODS, SORTS } from '../lib/filters'
import { mag, shortAgo, timeAgo, titleCase } from '../lib/format'
import type { Period, Quake } from '../lib/types'
import { Button, Check, CountUp, Kbd, Segmented, Select } from '../components/ui'
import Seismograph from '../components/Seismograph'
import QuakeList, { ListSkeleton } from '../components/QuakeList'
import { magClass } from '../lib/scales'
import MagHistogram from '../components/MagHistogram'
import ScaleLegend from '../components/ScaleLegend'
import QuakeDrawer from '../components/QuakeDrawer'
import { EmptyState, ErrorState } from '../components/States'
import type { FeedError } from '../lib/api'
import { CloudPanel } from '../components/CloudLayer'
import { useCloudTimeline } from '../lib/clouds/timeline'

// three.js loads only when the globe view is opened.
const GlobeView = lazy(() => import('../components/GlobeView'))

const WINDOW_MS: Record<Period, number> = {
  hour: 3600e3,
  day: 86400e3,
  week: 7 * 86400e3,
  month: 30 * 86400e3,
}

/** Scrolls to a section, leaving room for the header and, where it sticks, the toolbar. */
function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const bar = document.querySelector<HTMLElement>('.toolbar')
  const sticky = bar && getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight + 12 : 0
  const offset = -(76 + (id === 'explore' ? 0 : sticky))
  if (window.__lenis) window.__lenis.scrollTo(el, { offset, duration: 1.2 })
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: 'smooth' })
}

const ease = [0.22, 1, 0.36, 1] as const
/** For the LCP heading: moves in but is never hidden, so the browser can paint it at once. */
const slide = {
  hidden: { y: 24 },
  show: { y: 0, transition: { duration: 0.7, ease } },
}
const rise = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.08 * i, duration: 0.7, ease } }),
}

export default function Explorer() {
  const { filters, update, reset, eventId, setEvent } = useFilters()
  const { data, error, isPending, isFetching, refetch, dataUpdatedAt } = useFeed(filters.level, filters.period)
  const now = useNow(10_000)
  const online = useOnline()
  const isWide = useMedia('(min-width: 980px)')
  const [panelOpen, setPanelOpen] = useState(false)

  // The cloud layer contacts NASA GIBS and OpenWeatherMap only after the visitor turns it on.
  const clouds = useCloudTimeline(filters.clouds)
  const toggleClouds = useCallback((v: boolean) => update({ clouds: v }), [update])
  const showClouds = useCallback(() => update({ clouds: true }), [update])
  const [cloudOpacity, setCloudOpacity] = useState(0.9)
  const [dimClouds, setDimClouds] = useState(false)

  // The globe sits below the hero, so three.js loads only when it comes near the viewport
  // (or when an event is opened, since the globe then turns to it).
  const globeSlot = useRef<HTMLDivElement>(null)
  const [globeWanted, setGlobeWanted] = useState(false)
  useEffect(() => {
    if (globeWanted) return
    const el = globeSlot.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setGlobeWanted(true)
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [globeWanted])

  // Search text is local so typing stays instant, then debounced into the URL.
  const [text, setText] = useState(filters.q)
  const debounced = useDebounced(text)
  useEffect(() => {
    if (debounced !== filters.q) update({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])
  useEffect(() => {
    setText((t) => (t === filters.q ? t : filters.q))
  }, [filters.q])

  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault()
        scrollToId('explore')
        setTimeout(() => searchRef.current?.focus(), 300)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (online && error) refetch()
  }, [online]) // eslint-disable-line react-hooks/exhaustive-deps

  const all = data?.quakes ?? []
  const results = useMemo(() => applyFilters(all, filters), [all, filters])
  const types = useMemo(() => {
    const set = new Map<string, number>()
    all.forEach((q) => set.set(q.type, (set.get(q.type) ?? 0) + 1))
    return [...set.entries()].sort((a, b) => b[1] - a[1])
  }, [all])

  const summary = useMemo(() => {
    let strongest: Quake | null = null
    let felt = 0
    let tsunami = 0
    let reviewed = 0
    for (const q of all) {
      if (q.mag !== null && (!strongest || q.mag > (strongest.mag ?? -9))) strongest = q
      felt += q.felt ?? 0
      if (q.tsunami) tsunami++
      if (q.status === 'reviewed') reviewed++
    }
    const latest = all.reduce<Quake | null>((m, q) => (!m || q.time > m.time ? q : m), null)
    return { strongest, felt, tsunami, reviewed, latest }
  }, [all])

  const selected = useMemo(() => (eventId ? all.find((q) => q.id === eventId) ?? null : null), [eventId, all])
  const openQuake = useCallback((q: Quake) => setEvent(q.id), [setEvent])
  const closeQuake = useCallback(() => setEvent(null), [setEvent])
  const backToGlobe = useCallback(() => {
    setEvent(null)
    // The globe has already turned to the event; bring it into view once the panel is gone.
    setTimeout(() => scrollToId('globe'), 120)
  }, [setEvent])

  const active = countActive(filters)
  const periodLabel = PERIODS.find((p) => p.value === filters.period)!.label.toLowerCase()
  const showError = !!error && !data
  const loading = isPending && !data
  const dash = <span aria-label="Not available">-</span>
  const nextPeriod = PERIODS[PERIODS.findIndex((p) => p.value === filters.period) + 1]?.value

  const chips: { key: string; label: string; clear: () => void }[] = []
  if (filters.q) chips.push({ key: 'q', label: `"${filters.q}"`, clear: () => (setText(''), update({ q: '' })) })
  if (filters.minMag > -1) chips.push({ key: 'min', label: `M${filters.minMag.toFixed(1)}+`, clear: () => update({ minMag: -1 }) })
  if (filters.depth !== 'any')
    chips.push({ key: 'depth', label: DEPTHS.find((d) => d.value === filters.depth)!.label, clear: () => update({ depth: 'any' }) })
  if (filters.type !== 'any') chips.push({ key: 'type', label: titleCase(filters.type), clear: () => update({ type: 'any' }) })
  if (filters.tsunami) chips.push({ key: 'ts', label: 'Tsunami flag', clear: () => update({ tsunami: false }) })
  if (filters.reviewed) chips.push({ key: 'rv', label: 'Reviewed only', clear: () => update({ reviewed: false }) })

  const filterPanel = (
    <div className="panel-inner">
      <div className="panel-block">
        <div className="panel-row">
          <span className="field-label">Minimum magnitude</span>
          <output className="mono">{filters.minMag <= -1 ? 'Any' : `${filters.minMag.toFixed(1)}+`}</output>
        </div>
        <input
          type="range"
          className="range"
          min={-1}
          max={8}
          step={0.5}
          value={filters.minMag}
          aria-label="Minimum magnitude"
          style={{ ['--p' as string]: `${((filters.minMag + 1) / 9) * 100}%` }}
          onChange={(e) => update({ minMag: Number(e.target.value) })}
        />
        <MagHistogram quakes={all} minMag={filters.minMag} onPick={(m) => update({ minMag: m })} />
      </div>

      <fieldset className="panel-block">
        <legend className="field-label">Depth</legend>
        <div className="radios">
          {DEPTHS.map((d) => (
            <label key={d.value} className={`radio ${filters.depth === d.value ? 'is-on' : ''}`}>
              <input
                type="radio"
                name="depth"
                value={d.value}
                checked={filters.depth === d.value}
                onChange={() => update({ depth: d.value })}
              />
              <span>{d.label}</span>
              {d.hint && <small>{d.hint}</small>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="panel-block">
        <Select
          label="Event type"
          value={filters.type}
          onChange={(v) => update({ type: v })}
          options={[
            { value: 'any', label: `All types (${all.length.toLocaleString('en')})` },
            ...types.map(([t, n]) => ({ value: t, label: `${titleCase(t)} (${n.toLocaleString('en')})` })),
          ]}
        />
      </div>

      <div className="panel-block checks">
        <Check checked={filters.tsunami} onChange={(v) => update({ tsunami: v })} hint="Events the USGS flagged for tsunami review">
          Tsunami flag only
        </Check>
        <Check checked={filters.reviewed} onChange={(v) => update({ reviewed: v })} hint="Checked by a seismologist, not only automatic">
          Reviewed only
        </Check>
      </div>

      {active > 0 && (
        <Button variant="ghost" size="sm" onClick={() => (setText(''), reset())} icon={<X size={14} />}>
          Clear all filters
        </Button>
      )}
    </div>
  )

  return (
    <div className="desk">
      {/* HERO */}
      <section className="hero">
        <div className="wrap hero-grid">
          <motion.div initial="hidden" animate="show" className="hero-copy">
            <motion.p variants={rise} custom={0} className="live">
              <span className={`live-dot ${error ? 'is-off' : ''}`} aria-hidden="true" />
              {error && !data
                ? 'Feed unavailable'
                : dataUpdatedAt
                  ? `USGS feed, refreshed ${shortAgo(dataUpdatedAt, now)} ago`
                  : 'Connecting to the USGS feed'}
            </motion.p>
            <motion.h1 variants={slide}>
              Search the world's earthquakes <em>as the USGS reports them.</em>
            </motion.h1>
            <motion.p variants={rise} custom={2} className="lede">
              Quakeline reads the U.S. Geological Survey's public feed every minute. Filter events by magnitude, depth or
              place, sort them, see them on a globe with satellite clouds, and open any one for its full record and a local
              map.
            </motion.p>
            <motion.div variants={rise} custom={3} className="hero-cta">
              <Button size="lg" onClick={() => scrollToId('explore')} icon={<ArrowDown size={18} />}>
                Browse events
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToId('globe')}
                icon={<GlobeIcon size={18} />}
              >
                Open the globe
              </Button>
            </motion.div>
            <motion.p variants={rise} custom={4} className="hint">
              Press <Kbd>/</Kbd> anywhere to jump to search.
            </motion.p>
          </motion.div>

          <motion.div
            className="hero-card"
            initial={{ opacity: 0, y: 30, rotate: 1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.15 }}
          >
            <div className="hero-card-head">
              <span>Trace of the {periodLabel}</span>
              <span className="mono">{loading ? 'loading' : `${all.length.toLocaleString('en')} events`}</span>
            </div>
            <Seismograph quakes={all} windowMs={WINDOW_MS[filters.period]} now={now} loading={loading} />
            <div className="hero-card-axis mono">
              <span>{filters.period === 'hour' ? '60 min ago' : PERIODS.find((p) => p.value === filters.period)!.short + ' ago'}</span>
              <span>now</span>
            </div>
            <AnimatePresence mode="wait">
              {summary.latest ? (
                <motion.button
                  key={summary.latest.id}
                  className="latest"
                  onClick={() => openQuake(summary.latest!)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <span className={`mini-mag ${magClass(summary.latest.mag)}`}>{mag(summary.latest.mag)}</span>
                  <span className="latest-text">
                    <small>Most recent event, {timeAgo(summary.latest.time, now)}</small>
                    <strong>{summary.latest.place}</strong>
                  </span>
                </motion.button>
              ) : (
                <div className="latest latest-skel">
                  <span className="skel skel-mag-sm" />
                  <span className="skel skel-line" style={{ width: '70%' }} />
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* STATS: all computed from the live feed */}
        <div className="wrap">
          <motion.dl
            className="stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.35 }}
          >
            <div>
              <dt>Events, {periodLabel}</dt>
              <dd>{loading ? <span className="skel skel-num" /> : showError ? dash : <CountUp value={all.length} />}</dd>
            </div>
            <div>
              <dt>Strongest</dt>
              <dd>
                {loading ? (
                  <span className="skel skel-num" />
                ) : showError ? (
                  dash
                ) : summary.strongest ? (
                  <button className="stat-link" onClick={() => openQuake(summary.strongest!)}>
                    M<CountUp value={summary.strongest.mag ?? 0} decimals={1} />
                  </button>
                ) : (
                  '-'
                )}
                {summary.strongest && !loading && <small className="stat-sub">{summary.strongest.region}</small>}
              </dd>
            </div>
            <div>
              <dt>"Did you feel it?" reports</dt>
              <dd>{loading ? <span className="skel skel-num" /> : showError ? dash : <CountUp value={summary.felt} />}</dd>
            </div>
            <div>
              <dt>Reviewed by a seismologist</dt>
              <dd>
                {loading ? (
                  <span className="skel skel-num" />
                ) : showError ? (
                  dash
                ) : (
                  <>
                    <CountUp value={all.length ? Math.round((summary.reviewed / all.length) * 100) : 0} />%
                  </>
                )}
              </dd>
            </div>
          </motion.dl>
        </div>
      </section>

      {/* EXPLORER */}
      <section id="explore" className="explore">
        <div className="wrap">
          <div className="explore-head">
            <div>
              <h2>Explore the feed</h2>
              <p className="muted">
                {data?.title ? `Source: ${data.title}.` : 'Source: USGS summary feed.'} Results update on their own every 60
                seconds.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              icon={<RotateCw size={15} className={isFetching ? 'spin' : ''} />}
            >
              {isFetching ? 'Refreshing' : 'Refresh now'}
            </Button>
          </div>

          <div className="toolbar">
            <div className="search">
              <Search size={18} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Search places, e.g. Alaska, Japan, CA"
                aria-label="Search events by place"
              />
              {text ? (
                <button className="search-clear" onClick={() => setText('')} aria-label="Clear search">
                  <X size={16} />
                </button>
              ) : (
                <Kbd>/</Kbd>
              )}
            </div>
            <Segmented
              id="period"
              label="Time window"
              value={filters.period}
              onChange={(v) => update({ period: v })}
              options={PERIODS.map((p) => ({ value: p.value, label: p.short, title: p.label }))}
            />
            <Select
              label="Feed"
              hideLabel
              value={filters.level}
              onChange={(v) => update({ level: v })}
              options={LEVELS.map((l) => ({
                ...l,
                label:
                  filters.period === 'month' && (l.value === 'all' || l.value === '1.0') ? `${l.label} (too large for 30 days)` : l.label,
              }))}
            />
            <Select label="Sort" hideLabel value={filters.sort} onChange={(v) => update({ sort: v })} options={SORTS} />
            {!isWide && (
              <Button
                variant="outline"
                onClick={() => setPanelOpen((o) => !o)}
                aria-expanded={panelOpen}
                icon={<SlidersHorizontal size={16} />}
              >
                Filters{active ? ` (${active})` : ''}
              </Button>
            )}
          </div>

          <div className="results-bar">
            <p className="results-count" aria-live="polite">
              {loading ? (
                'Loading events'
              ) : showError ? (
                'No data'
              ) : (
                <>
                  Showing <strong>{results.length.toLocaleString('en')}</strong> of {all.length.toLocaleString('en')} events
                </>
              )}
            </p>
            <div className="chips">
              <AnimatePresence initial={false}>
                {chips.map((c) => (
                  <motion.button
                    key={c.key}
                    layout
                    className="chip"
                    onClick={c.clear}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    aria-label={`Remove filter ${c.label}`}
                  >
                    {c.label}
                    <X size={13} aria-hidden="true" />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
            {isFetching && data && <div className="fetchbar" aria-hidden="true" />}
          </div>

          {error && data && (
            <div className="inline-warn" role="status">
              The latest refresh failed ({(error as FeedError).message}). You are seeing data from{' '}
              {timeAgo(dataUpdatedAt, now)}.
            </div>
          )}

          <div id="globe" className="viz-card globe-card">
            <div ref={globeSlot}>
              {globeWanted || eventId ? (
                <Suspense fallback={<GlobeWait />}>
                  <GlobeView
                    quakes={results}
                    selectedId={eventId}
                    onSelect={openQuake}
                    tl={clouds}
                    cloudsOn={filters.clouds}
                    onShowClouds={showClouds}
                    cloudOpacity={cloudOpacity}
                    dimClouds={dimClouds}
                  />
                </Suspense>
              ) : (
                <GlobeWait />
              )}
            </div>
            <CloudPanel
              tl={clouds}
              on={filters.clouds}
              onToggle={toggleClouds}
              opacity={cloudOpacity}
              onOpacity={setCloudOpacity}
              dim={dimClouds}
              onDim={setDimClouds}
            />
            <div className="viz-legend">
              <ScaleLegend scale="mag" />
              <span className="viz-note">
                <span className="legend-dots" aria-hidden="true">
                  <i style={{ width: 5, height: 5 }} />
                  <i style={{ width: 10, height: 10 }} />
                  <i style={{ width: 18, height: 18 }} />
                </span>
                Dot size follows magnitude; rings mark M4.5 and up. Click a dot, or a row in the list, for details and a local map.
              </span>
            </div>
          </div>

          <div className="explore-grid">
            {isWide ? (
              <aside className="panel" aria-label="Filters">
                {filterPanel}
              </aside>
            ) : (
              <AnimatePresence initial={false}>
                {panelOpen && (
                  <motion.aside
                    className="panel panel-mobile"
                    aria-label="Filters"
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease }}
                  >
                    {filterPanel}
                  </motion.aside>
                )}
              </AnimatePresence>
            )}

            <div className="results">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div key="load" exit={{ opacity: 0 }}>
                    <ListSkeleton />
                  </motion.div>
                ) : showError ? (
                  <ErrorState key="err" error={error} onRetry={() => refetch()} retrying={isFetching} />
                ) : results.length === 0 ? (
                  <EmptyState
                    key="empty"
                    query={filters.q}
                    activeCount={active}
                    total={all.length}
                    onReset={() => (setText(''), reset())}
                    canWiden={!!nextPeriod}
                    onWiden={() => nextPeriod && update({ period: nextPeriod })}
                  />
                ) : (
                  <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="list-legends">
                      <ScaleLegend scale="mag" compact />
                      <ScaleLegend scale="depth" compact />
                    </div>
                    <QuakeList
                      quakes={results}
                      now={now}
                      onOpen={openQuake}
                      resetKey={`${filters.period}${filters.level}${filters.sort}${filters.q}${filters.minMag}${filters.depth}${filters.type}${filters.tsunami}${filters.reviewed}`}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* GUIDE */}
      <section className="guide">
        <div className="wrap">
          <h2>Reading an event</h2>
          <div className="guide-grid">
            {[
              {
                n: '01',
                h: 'Magnitude is logarithmic',
                p: 'Each whole step on the scale means about 32 times more energy. An M6 releases roughly a thousand times the energy of an M4.',
              },
              {
                n: '02',
                h: 'Depth changes the shaking',
                p: 'Shallow events, under 70 km, tend to shake the surface harder than deep ones of the same size, because the energy travels less far.',
              },
              {
                n: '03',
                h: 'Early numbers move',
                p: 'Automatic solutions arrive within minutes. Magnitude and location often shift once a seismologist reviews the event, so check the status.',
              },
              {
                n: '04',
                h: 'Coverage is uneven',
                p: 'The USGS lists small events in the United States in detail. Elsewhere, its global catalogue is most complete from about M4.5 upward.',
              },
            ].map((g, i) => (
              <motion.article
                key={g.n}
                className="guide-card"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, ease, delay: i * 0.08 }}
              >
                <span className="guide-n mono">{g.n}</span>
                <h3>{g.h}</h3>
                <p>{g.p}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <QuakeDrawer quake={selected} all={all} now={now} onClose={closeQuake} onSelect={openQuake} onBack={backToGlobe} />
    </div>
  )
}

/** Holds the globe's exact size while three.js loads, so nothing below it moves. */
function GlobeWait() {
  return (
    <div className="globe-wrap">
      <div className="globe-plate is-waiting" role="status">
        <span className="mono">Loading the globe</span>
      </div>
    </div>
  )
}
