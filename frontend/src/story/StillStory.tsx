import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { coord, depthLabel, km, mag, nf, timeAgo, utcTime } from '../lib/format'
import { minSec, nearestStations } from '../lib/story'
import { StrataArt, LockedArt } from './chapters/Stress'
import InkDefs from './InkDefs'
import { RuptureRig } from './RuptureRig'
import { spanWords, type StoryData } from './chapters/shared'

const minSecSafe = (s: number | null) => (s === null ? 'Beyond 100°, no direct P' : `P ≈ ${minSec(s)}`)

/** The story for prefers-reduced-motion: the same facts as a still sequence of panels. */
export default function StillStory({ hero, quakes, period, now }: StoryData) {
  const stations = nearestStations(hero, 9)
  return (
    <div className="still">
      <InkDefs />
      <header className="still-head">
        <p className="ch-tag">
          <span>Quakeline</span>
          <span>One event, from the rock to your screen</span>
        </p>
        <h1 className="still-q">
          The ground moved {nf.format(quakes.length)} times {spanWords(period)}.
        </h1>
        <Link to="/explore" className="gate-btn gate-btn-ink">
          Go to the data
        </Link>
      </header>

      <ol className="still-list">
        <li className="still-pnl">
          <span className="ch-tag">
            <span>Ch. 01</span>
            <span>Orbit</span>
          </span>
          <p className="still-cap">
            This is the strongest of them. <b>M{mag(hero.mag)}</b>, <b>{hero.place}</b>. Recorded {timeAgo(hero.time, now)}, at{' '}
            {coord(hero.lat, hero.lon)}, {utcTime(hero.time)}.
          </p>
        </li>
        <li className="still-pnl">
          <span className="ch-tag">
            <span>Ch. 02</span>
            <span>The dive</span>
          </span>
          <p className="still-big">{km(hero.depth)} down</p>
          <p className="still-cap">
            Its hypocentre, where the rock first broke, is {km(hero.depth)} below the surface. The USGS counts this depth as{' '}
            <b>{depthLabel(hero.depth).toLowerCase()}</b>.
          </p>
        </li>
        <li className="still-pnl still-art">
          <span className="ch-tag">
            <span>Ch. 03</span>
            <span>Stress</span>
          </span>
          <div className="still-grid">
            <figure className="pnl">
              <div className="pnl-art">
                <img className="art-img" src="/plates/holmes-toroweap.png" alt="" width="1100" height="778" loading="lazy" />
              </div>
              <figcaption className="still-fc">Rock on each side of a fault is pushed in opposite directions, year after year.</figcaption>
            </figure>
            <figure className="pnl still-bent">
              <div className="pnl-art">
                <StrataArt />
              </div>
              <figcaption className="still-fc">Friction keeps the fault locked. So the rock bends instead of sliding.</figcaption>
            </figure>
            <figure className="pnl">
              <div className="pnl-art">
                <LockedArt />
              </div>
              <figcaption className="still-fc">Bent rock stores energy, like a drawn bow. Hairline cracks start to open.</figcaption>
            </figure>
          </div>
        </li>
        <li className="still-pnl">
          <span className="ch-tag">
            <span>Ch. 04</span>
            <span>Rupture</span>
          </span>
          <RuptureRig hero={hero} reduced className="is-still" />
        </li>
        <li className="still-pnl">
          <span className="ch-tag">
            <span>Ch. 05</span>
            <span>Waves</span>
          </span>
          <p className="still-cap">P waves arrive first. S waves follow, slower and stronger.</p>
          <figure className="pnl mallet-still">
            <img src="/plates/mallet-wavefronts.png" alt="Engraving of wave fronts spreading in rings from a focus along a fault" width="700" height="483" loading="lazy" />
            <figcaption>Wave fronts from a focus. Robert Mallet, 1862.</figcaption>
          </figure>
        </li>
        <li className="still-pnl">
          <span className="ch-tag">
            <span>Ch. 06</span>
            <span>Stations</span>
          </span>
          <p className="still-cap">The nine closest Global Seismographic Network stations, nearest first. Times are computed, approx.</p>
          <ol className="still-st">
            {stations.map((s) => (
              <li key={s.code}>
                <b>{s.code}</b>
                <span>{s.site}</span>
                <span>{nf.format(Math.round(s.km))} km</span>
                <span>{minSecSafe(s.pSec)}</span>
              </li>
            ))}
          </ol>
        </li>
        <li className="still-pnl still-end">
          <span className="ch-tag">
            <span>Ch. 07</span>
            <span>Published</span>
          </span>
          <p className="still-poster">The ground is never still.</p>
          <Link to="/explore" className="poster-btn">
            Go to the data <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </li>
      </ol>
    </div>
  )
}
