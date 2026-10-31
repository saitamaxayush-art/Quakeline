import { useEffect, useState, useSyncExternalStore } from 'react'
import type { FrameErrorCode, FrameMeta, WorkerIn, WorkerOut } from './config'
import { prefersReducedMotion } from '../motion'

export interface FrameState extends FrameMeta {
  status: 'loading' | 'ready' | 'error'
  error?: FrameErrorCode
  /** Equirectangular cover, EQ_W x EQ_H, one byte per pixel. */
  eq?: Uint8Array
  /** Share of the globe (within the Mercator limits) that has imagery. */
  coverage?: number
  fetchedAt?: number | null
}

export interface TimelineSnapshot {
  phase: 'off' | 'planning' | 'running' | 'offline'
  frames: FrameState[]
  gibsOk: boolean
  playing: boolean
  /** Playback is paused on a frame that has not loaded yet. */
  waiting: boolean
  /** The frame that dominates the current blend; labels follow it. */
  index: number
}

/** What the globe draws: frame a blended toward frame b by t. Mutated in place. */
export interface CloudView {
  a: number
  b: number
  t: number
}

const HOLD = 0.75
const HOLD_END = 1.6
const FADE = 0.5
const STALE_MS = 15 * 60e3

/**
 * The cloud timeline: owns the worker, the loaded frames and playback. Discrete changes go to
 * React through subscribe/getSnapshot; the per-frame blend goes through subscribeView, so the
 * crossfade never re-renders the page.
 */
export class CloudTimeline {
  readonly view: CloudView = { a: -1, b: -1, t: 0 }
  private snap: TimelineSnapshot = { phase: 'off', frames: [], gibsOk: true, playing: false, waiting: false, index: -1 }
  private listeners = new Set<() => void>()
  private viewListeners = new Set<() => void>()
  private worker: Worker | null = null
  private raf = 0
  private last = 0
  private hold = HOLD
  private fading = false
  private touched = false
  private loadedAt = 0
  private enabled = false

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getSnapshot = () => this.snap
  subscribeView = (fn: () => void) => {
    this.viewListeners.add(fn)
    return () => this.viewListeners.delete(fn)
  }
  /** Scrubber position: a fraction between neighbouring frames, or the nearer end of a wrap. */
  getPos = () => {
    const { a, b, t } = this.view
    if (a < 0) return 0
    if (b === a + 1) return a + t
    return t < 0.5 ? a : b
  }

  private set(patch: Partial<TimelineSnapshot>) {
    this.snap = { ...this.snap, ...patch }
    this.listeners.forEach((fn) => fn())
  }

  private emitView() {
    const idx = this.view.t < 0.5 ? this.view.a : this.view.b
    if (idx !== this.snap.index) this.set({ index: idx })
    this.viewListeners.forEach((fn) => fn())
  }

  private onOnline = () => {
    if (!this.enabled) return
    const failed = this.snap.frames.some((f) => f.status === 'error' && (f.error === 'offline' || f.error === 'upstream' || f.error === 'gibs'))
    if (this.snap.phase === 'offline' || failed || this.snap.frames.length === 0) this.load()
  }
  private onOffline = () => {
    if (this.enabled && this.snap.phase !== 'running') this.set({ phase: 'offline' })
  }

  enable() {
    if (this.enabled) return
    this.enabled = true
    window.addEventListener('online', this.onOnline)
    window.addEventListener('offline', this.onOffline)
    const fresh = Date.now() - this.loadedAt < STALE_MS
    if (fresh && this.snap.frames.length) {
      this.set({ phase: 'running' })
      return
    }
    this.load()
  }

  disable() {
    if (!this.enabled) return
    this.enabled = false
    this.pause()
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('offline', this.onOffline)
    this.set({ phase: 'off' })
  }

  retry() {
    this.load()
  }

  private load() {
    this.stopWorker()
    this.pause()
    this.touched = false
    this.view.a = this.view.b = -1
    this.view.t = 0
    if (navigator.onLine === false) {
      this.set({ phase: 'offline', frames: [], index: -1 })
      this.emitView()
      return
    }
    this.set({ phase: 'planning', frames: [], gibsOk: true, index: -1, waiting: false })
    this.emitView()
    let worker: Worker
    try {
      worker = new Worker(new URL('./cloud.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      this.set({
        phase: 'running',
        frames: [{ index: 0, kind: 'owm', time: null, layers: [], status: 'error', error: 'unsupported' }],
        gibsOk: false,
      })
      return
    }
    this.worker = worker
    this.loadedAt = Date.now()
    worker.onmessage = (e: MessageEvent<WorkerOut>) => this.onMessage(e.data)
    worker.onerror = () => {
      this.set({
        phase: 'running',
        frames: this.snap.frames.length
          ? this.snap.frames.map((f) => (f.status === 'loading' ? { ...f, status: 'error', error: 'unsupported' } : f))
          : [{ index: 0, kind: 'owm', time: null, layers: [], status: 'error', error: 'unsupported' }],
      })
    }
    const msg: WorkerIn = { type: 'start', now: Date.now() }
    worker.postMessage(msg)
  }

  private onMessage(m: WorkerOut) {
    if (m.type === 'plan') {
      this.set({ phase: 'running', gibsOk: m.gibsOk, frames: m.frames.map((f) => ({ ...f, status: 'loading' })) })
      return
    }
    const frames = this.snap.frames.slice()
    const f = frames[m.index]
    if (!f) return
    if (m.type === 'frameError') {
      frames[m.index] = { ...f, status: 'error', error: m.code }
      this.set({ frames })
      this.afterFrame()
      return
    }
    frames[m.index] = { ...f, status: 'ready', eq: m.eq, coverage: m.coverage, fetchedAt: m.fetchedAt }
    this.set({ frames })
    this.afterFrame()
  }

  /** Until the visitor touches the timeline, show the newest frame that has loaded. */
  private afterFrame() {
    if (this.touched) {
      if (this.snap.waiting) this.set({ waiting: false })
      return
    }
    const frames = this.snap.frames
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i].status === 'ready') {
        if (this.view.a !== i) {
          this.view.a = this.view.b = i
          this.view.t = 0
          this.emitView()
        }
        return
      }
    }
  }

  /** Next frame to play. After the newest, playback wraps to the oldest frame that has loaded. */
  private nextPlayable(from: number) {
    const frames = this.snap.frames
    for (let j = from + 1; j < frames.length; j++) if (frames[j].status !== 'error') return j
    const firstReady = frames.findIndex((f) => f.status === 'ready')
    return firstReady >= 0 ? firstReady : frames.findIndex((f) => f.status === 'loading')
  }

  readyCount() {
    return this.snap.frames.filter((f) => f.status === 'ready').length
  }

  play() {
    if (this.snap.playing || this.readyCount() < 2) return
    this.touched = true
    const frames = this.snap.frames
    if (this.view.a < 0) return
    // Settle any half-way blend on its nearer frame.
    if (this.view.t > 0) {
      this.view.a = this.view.t < 0.5 ? this.view.a : this.view.b
      this.view.t = 0
    }
    this.view.b = this.view.a
    this.fading = false
    // Pressing play on the newest frame starts again from the oldest.
    const lastPlayable = frames.map((f) => f.status !== 'error').lastIndexOf(true)
    this.hold = this.view.a === lastPlayable ? 0 : HOLD * 0.5
    this.set({ playing: true })
    this.last = performance.now()
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(this.tick)
  }

  pause() {
    cancelAnimationFrame(this.raf)
    if (this.snap.playing || this.snap.waiting) this.set({ playing: false, waiting: false })
  }

  toggle() {
    if (this.snap.playing) this.pause()
    else this.play()
  }

  private tick = (ts: number) => {
    const dt = Math.min(0.1, (ts - this.last) / 1000)
    this.last = ts
    const reduced = prefersReducedMotion()
    const v = this.view
    const frames = this.snap.frames
    if (this.fading) {
      v.t += reduced ? 1 : dt / FADE
      if (v.t >= 1) {
        v.a = v.b
        v.t = 0
        this.fading = false
        const lastPlayable = frames.map((f) => f.status !== 'error').lastIndexOf(true)
        this.hold = (v.a === lastPlayable ? HOLD_END : HOLD) * (reduced ? 1.6 : 1)
      }
      this.emitView()
    } else {
      this.hold -= dt
      if (this.hold <= 0) {
        const next = this.nextPlayable(v.a)
        if (next < 0 || next === v.a) {
          this.pause()
          return
        }
        if (frames[next].status === 'ready') {
          v.b = next
          this.fading = true
          if (this.snap.waiting) this.set({ waiting: false })
        } else if (!this.snap.waiting) {
          this.set({ waiting: true })
        }
      }
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  /** Scrubbing: any position between frames blends its two neighbours. */
  seek(pos: number) {
    this.touched = true
    this.pause()
    const frames = this.snap.frames
    if (!frames.length) return
    const p = Math.max(0, Math.min(frames.length - 1, pos))
    let a = Math.floor(p)
    let b = Math.min(frames.length - 1, a + 1)
    let t = p - a
    const ready = (i: number) => frames[i]?.status === 'ready'
    if (!ready(a) || !ready(b)) {
      // Snap to the nearest loaded frame instead of blending into nothing.
      const target = Math.round(p)
      let best = -1
      for (let i = 0; i < frames.length; i++) if (ready(i) && (best < 0 || Math.abs(i - target) < Math.abs(best - target))) best = i
      if (best < 0) return
      a = b = best
      t = 0
    }
    this.view.a = a
    this.view.b = b
    this.view.t = t
    this.fading = false
    this.emitView()
  }

  private stopWorker() {
    this.worker?.terminate()
    this.worker = null
  }

  destroy() {
    this.disable()
    this.stopWorker()
  }
}

/** One timeline per page. Loads only while `enabled`. */
export function useCloudTimeline(enabled: boolean) {
  const [tl] = useState(() => new CloudTimeline())
  useEffect(() => () => tl.destroy(), [tl])
  useEffect(() => {
    if (enabled) tl.enable()
    else tl.disable()
  }, [enabled, tl])
  return tl
}

export function useTimelineSnapshot(tl: CloudTimeline) {
  return useSyncExternalStore(tl.subscribe, tl.getSnapshot)
}

export function useTimelinePos(tl: CloudTimeline) {
  return useSyncExternalStore(tl.subscribeView, tl.getPos)
}
