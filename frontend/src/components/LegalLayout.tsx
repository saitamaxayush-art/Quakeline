import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { SITE } from '../lib/site'

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

export default function LegalLayout({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  const [active, setActive] = useState(sections[0]?.id)

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActive(vis[0].target.id)
      },
      { rootMargin: '-20% 0px -65% 0px' },
    )
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [sections])

  const go = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    if (window.__lenis) window.__lenis.scrollTo(el, { offset: -90, duration: 1 })
    else el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="legal">
      <header className="legal-hero">
        <div className="wrap">
          <motion.p className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            Last updated {SITE.lastUpdated}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            {title}
          </motion.h1>
          <motion.div className="legal-intro" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            {intro}
          </motion.div>
        </div>
      </header>
      <div className="wrap legal-grid">
        <nav className="toc" aria-label="On this page">
          <p className="toc-h">On this page</p>
          <ol>
            {sections.map((s, i) => (
              <li key={s.id}>
                <button className={active === s.id ? 'is-active' : ''} onClick={() => go(s.id)}>
                  <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="legal-body">
          {sections.map((s, i) => (
            <motion.section
              key={s.id}
              id={s.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5 }}
            >
              <h2>
                <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </h2>
              {s.body}
            </motion.section>
          ))}
        </div>
      </div>
    </div>
  )
}
