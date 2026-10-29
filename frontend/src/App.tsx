import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import Header from './components/Header'
import Footer from './components/Footer'

// The story is the landing page and loads with the app. Every other route is its own chunk,
// so the story never downloads the map.
const Explorer = lazy(() => import('./pages/Explorer'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const Credits = lazy(() => import('./pages/Credits'))
const NotFound = lazy(() => import('./pages/NotFound'))
import Story from './story/Story'
import { readGate } from './lib/story'
import { scrollToTop, startSmoothScroll } from './lib/scroll'
import { DUR, EASE } from './lib/motion'

/** Explorer parameters that used to live on "/". Links shared before the story existed still open the right view. */
const EXPLORER_KEYS = ['period', 'level', 'q', 'min', 'depth', 'tsunami', 'reviewed', 'type', 'sort', 'view', 'color', 'event']

function Home() {
  const { search } = useLocation()
  const sp = new URLSearchParams(search)
  if (EXPLORER_KEYS.some((k) => sp.has(k))) return <Navigate to={`/explore${search}`} replace />
  if (readGate() === 'skip') return <Navigate to="/explore" replace />
  return <Story />
}

const hasViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document

export default function App() {
  const location = useLocation()

  useEffect(() => startSmoothScroll(), [])
  useEffect(() => {
    scrollToTop(true)
  }, [location.pathname])

  const routes = (
    <Suspense fallback={<div className="route-wait" />}>
      <Routes location={location}>
      <Route path="/" element={<Home />} />
      <Route path="/explore" element={<Explorer />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/credits" element={<Credits />} />
      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )

  return (
    <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 260, damping: 32 }}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Header />
      {hasViewTransitions ? (
        // Route changes go through document.startViewTransition (see the viewTransition flag on links).
        <main id="main">{routes}</main>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            id="main"
            key={location.pathname}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: DUR.md, ease: EASE.out }}
          >
            {routes}
          </motion.main>
        </AnimatePresence>
      )}
      <Footer />
    </MotionConfig>
  )
}
