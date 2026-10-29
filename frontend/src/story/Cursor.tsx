import { useEffect, useRef } from 'react'
import { gsap } from '../lib/scroll'

/** Ink ring cursor for the story only. Fine pointers only; hidden over the HOLD zone, where the button follows instead. */
export default function Cursor() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia('(pointer: fine)').matches) return
    document.documentElement.classList.add('has-cursor')
    const qx = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3.out' })
    const qy = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3.out' })
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      qx(e.clientX)
      qy(e.clientY)
      const t = e.target as Element | null
      el.classList.toggle('is-link', !!t?.closest('a, button:not(.hold)'))
      el.classList.toggle('is-off', !!t?.closest('.hold-zone, .ch-rupture'))
      el.classList.add('is-on')
    }
    const leave = () => el.classList.remove('is-on')
    window.addEventListener('pointermove', move)
    document.addEventListener('pointerleave', leave)
    return () => {
      document.documentElement.classList.remove('has-cursor')
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
    }
  }, [])
  return (
    <div ref={ref} className="cursor" aria-hidden="true">
      <i />
    </div>
  )
}
