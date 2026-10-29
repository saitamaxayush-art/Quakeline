import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { writeGate } from '../lib/story'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" fill="var(--ink)" />
      <path d="M3 17h6l3-9 4 16 3-11 2 4h8" fill="none" stroke="var(--paper)" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  )
}

const links = [
  { to: '/', label: 'Story' },
  { to: '/explore', label: 'Explorer' },
  { to: '/credits', label: 'Credits' },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const story = pathname === '/'

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24)
    fn()
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''} ${story ? 'is-story' : ''}`}>
      <div className="wrap header-inner">
        <Link to="/explore" className="brand" aria-label="Quakeline explorer" viewTransition>
          <Logo />
          <span>Quakeline</span>
        </Link>
        <nav aria-label="Main">
          <ul className="nav">
            {links.map((l) => {
              const active = l.to === '/' ? story : pathname.startsWith(l.to)
              return (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    viewTransition
                    className={`nav-link ${active ? 'is-active' : ''}`}
                    end={l.to === '/'}
                    // Choosing the story again forgets an earlier "skip to data".
                    onClick={l.to === '/' ? () => writeGate(null) : undefined}
                  >
                    {active && <motion.span layoutId="nav-active" className="nav-marker" transition={{ type: 'spring', stiffness: 380, damping: 34 }} />}
                    <span className="nav-text">{l.label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}
