import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { EASE } from '../lib/motion'

export default function NotFound() {
  return (
    <section className="notfound wrap">
      <svg viewBox="0 0 400 80" className="nf-trace" aria-hidden="true">
        <defs>
          <mask id="nf-mask" maskUnits="userSpaceOnUse">
            <motion.rect x="0" y="0" width="400" height="80" fill="#fff" initial={{ x: -400 }} animate={{ x: 0 }} transition={{ duration: 1.4, ease: EASE.inOut }} />
          </mask>
        </defs>
        <path
          mask="url(#nf-mask)"
          d="M0 40 H140 L150 20 L160 62 L170 8 L182 72 L194 30 L204 46 L214 40 H400"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="miter"
        />
      </svg>
      <p className="eyebrow">Error 404</p>
      <h1>Not on the record</h1>
      <p>This page is not on the record. The address may be mistyped, or the page was moved.</p>
      <Link to="/explore" className="btn btn-solid btn-lg" viewTransition>
        <span>Open the explorer</span>
      </Link>
    </section>
  )
}
