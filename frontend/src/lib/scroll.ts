import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from './motion'

gsap.registerPlugin(ScrollTrigger)

declare global {
  interface Window {
    __lenis?: Lenis
  }
}

/**
 * One Lenis instance for the whole site, driven by the GSAP ticker so ScrollTrigger
 * and smooth scrolling read the same frame. Returns a cleanup function.
 */
export function startSmoothScroll() {
  if (prefersReducedMotion()) return () => {}
  const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, smoothWheel: true })
  window.__lenis = lenis
  lenis.on('scroll', ScrollTrigger.update)
  const tick = (time: number) => lenis.raf(time * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)
  return () => {
    gsap.ticker.remove(tick)
    lenis.destroy()
    window.__lenis = undefined
  }
}

export function scrollToTop(immediate = true) {
  if (window.__lenis) window.__lenis.scrollTo(0, { immediate, force: true })
  else window.scrollTo({ top: 0, behavior: immediate ? 'instant' : 'smooth' })
}

export function lockScroll(lock: boolean) {
  const lenis = window.__lenis
  if (lock) lenis?.stop()
  else lenis?.start()
  document.documentElement.classList.toggle('lock', lock)
}

export { gsap, ScrollTrigger }
