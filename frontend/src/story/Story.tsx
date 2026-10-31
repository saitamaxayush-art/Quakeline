import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMedia, useNow, useStoryFeed } from '../hooks'
import { readGate, writeGate } from '../lib/story'
import { lockScroll, scrollToTop, ScrollTrigger } from '../lib/scroll'
import Gate from './Gate'
import InkDefs from './InkDefs'
import Cursor from './Cursor'
import StillStory from './StillStory'
import { playCard } from './chapters/shared'
import Orbit from './chapters/Orbit'
import Dive from './chapters/Dive'
import Stress from './chapters/Stress'
import Rupture from './chapters/Rupture'
import Waves from './chapters/Waves'
import Stations from './chapters/Stations'
import Published from './chapters/Published'
import ChapterRail from './ChapterRail'
import { measureSections, stage } from './stage'
import './story.css'

const StoryStage = lazy(() => import('./StoryStage'))

type GateState = 'open' | 'playing' | 'closed'

function resetStage() {
  stage.flood = 0
  Object.assign(stage.crust, { pan: 0, debris: 0, slip: 0, charge: 0 })
}

export default function Story() {
  const feed = useStoryFeed()
  const now = useNow(30_000)
  const navigate = useNavigate()
  const reduced = useMedia('(prefers-reduced-motion: reduce)')
  const low = useMedia('(max-width: 760px), (pointer: coarse)')
  const wide = useMedia('(min-width: 900px)')
  const [stored] = useState(readGate)
  const [gate, setGate] = useState<GateState>('open')
  const [load3d, setLoad3d] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const ready = !!feed.hero
  stage.wide = wide

  useEffect(() => resetStage, [])

  useEffect(() => {
    if (reduced || gate === 'closed') return
    scrollToTop(true)
    lockScroll(true)
    document.documentElement.classList.add('gate-open')
    return () => {
      lockScroll(false)
      document.documentElement.classList.remove('gate-open')
    }
  }, [gate, reduced])

  const measure = useCallback(() => root.current && measureSections(root.current), [])
  useEffect(() => {
    if (!ready || reduced) return
    measure()
    ScrollTrigger.addEventListener('refresh', measure)
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
    return () => {
      cancelAnimationFrame(id)
      ScrollTrigger.removeEventListener('refresh', measure)
    }
  }, [ready, reduced, measure])

  // The gate only ever leaves on the reader's input: a button, or a scroll that means "follow".
  const follow = useCallback(() => {
    writeGate('follow')
    if (reduced) return setGate('closed')
    setLoad3d(true)
    setGate('playing')
  }, [reduced])

  useEffect(() => {
    if (gate !== 'open' || !ready) return
    let touchY = 0
    const onWheel = (e: WheelEvent) => e.deltaY > 0 && follow()
    const onTouchStart = (e: TouchEvent) => (touchY = e.touches[0].clientY)
    const onTouchMove = (e: TouchEvent) => touchY - e.touches[0].clientY > 30 && follow()
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return
      if (['ArrowDown', 'PageDown', 'End', ' '].includes(e.key)) follow()
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [gate, ready, follow])

  const reopenGate = () => {
    scrollToTop(true)
    setGate('open')
  }
  const skip = () => {
    writeGate('skip')
    navigate('/explore', { viewTransition: true })
  }

  const gateProps = {
    count: feed.quakes.length,
    period: feed.period,
    loading: feed.loading || (!ready && !feed.error),
    error: feed.error && !ready ? feed.error : null,
    remembered: stored === 'skip',
    onFollow: follow,
    onSkip: skip,
    onRetry: feed.retry,
  }

  if (reduced) {
    if (gate === 'closed' && feed.hero) {
      return <StillStory hero={feed.hero} quakes={feed.quakes} period={feed.period} generated={feed.generated} now={now} />
    }
    return (
      <div className="story">
        <Gate {...gateProps} onDone={() => {}} playing={false} />
      </div>
    )
  }

  const data = feed.hero ? { hero: feed.hero, quakes: feed.quakes, period: feed.period, generated: feed.generated, now } : null

  return (
    <div className="story" ref={root}>
      <InkDefs />
      <Cursor />
      {load3d && data && (
        <Suspense fallback={null}>
          <StoryStage quakes={data.quakes} focus={data.hero} low={low} />
        </Suspense>
      )}
      {gate === 'closed' && data && <ChapterRail onGate={reopenGate} />}
      {data && (
        <>
          <Orbit {...data} />
          <Dive {...data} />
          <Stress {...data} />
          <Rupture {...data} />
          <Waves {...data} />
          <Stations {...data} />
          <Published {...data} />
        </>
      )}
      {gate !== 'closed' && (
        <Gate
          {...gateProps}
          onDone={() => {
            setGate('closed')
            // Ch. 1 begins at the top of the page: draw its title card as the gate wipes away.
            requestAnimationFrame(() => playCard(root.current?.querySelector('[data-ch="orbit"]') ?? null))
          }}
          playing={gate === 'playing'}
        />
      )}
    </div>
  )
}
