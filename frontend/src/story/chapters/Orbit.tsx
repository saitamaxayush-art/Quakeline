import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { coord, mag, timeAgo, utcTime } from '../../lib/format'
import { Caption, hideCaption, readCaption } from '../Caption'
import { Chapter, chapterTimeline, spanWords, type StoryData } from './shared'

export default function Orbit({ hero, quakes, period, now }: StoryData) {
  const ref = useRef<HTMLElement>(null)
  const c1 = useRef<HTMLDivElement>(null)
  const c2 = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const tl = chapterTimeline(ref.current)
      tl.to('.scroll-cue', { autoAlpha: 0, duration: 0.5 }, 0)
      readCaption(tl, c1.current, 2)
      readCaption(tl, c2.current, 5.4)
      tl.fromTo('.readout', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 4.4)
      hideCaption(tl, c1.current, 9)
      hideCaption(tl, c2.current, 9.1)
      tl.to('.readout', { autoAlpha: 0, duration: 0.5 }, 9.2)
      tl.set({}, {}, 10)
    },
    { scope: ref, dependencies: [hero.id] },
  )

  return (
    <Chapter ref={ref} id="orbit" sub={`${quakes.length.toLocaleString('en')} earthquakes ${spanWords(period)}. This story follows one of them.`}>
      <div className="cap-col">
        <Caption ref={c1} segs={['This is the strongest of them.', { hl: `M${mag(hero.mag)},` }, { hl: hero.place + '.' }]} />
        <Caption
          ref={c2}
          segs={['Recorded', { hl: timeAgo(hero.time, now) + ',' }, 'at', { hl: `${hero.depth < 10 ? hero.depth.toFixed(1) : Math.round(hero.depth)} km` }, 'below the surface.']}
        />
      </div>

      <dl className="readout">
        <div>
          <dt>Epicentre</dt>
          <dd>{coord(hero.lat, hero.lon)}</dd>
        </div>
        <div>
          <dt>Origin time</dt>
          <dd>{utcTime(hero.time)}</dd>
        </div>
        <div>
          <dt>Magnitude</dt>
          <dd>
            {mag(hero.mag)} {hero.magType ?? ''}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{hero.status}</dd>
        </div>
      </dl>

      <p className="scroll-cue" aria-hidden="true">
        <span>Scroll</span>
        <i />
      </p>
    </Chapter>
  )
}
