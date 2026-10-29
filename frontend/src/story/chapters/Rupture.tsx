import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { RuptureRig, type RuptureRigHandle } from '../RuptureRig'
import { Chapter, chapterTimeline, type StoryData } from './shared'

export default function Rupture({ hero }: StoryData) {
  const ref = useRef<HTMLElement>(null)
  const rig = useRef<RuptureRigHandle>(null)

  useGSAP(
    () => {
      // Scrolling back above the chapter resets the scene, so it can be held again.
      const tl = chapterTimeline(ref.current, { onLeaveBack: () => rig.current?.reset() })
      tl.fromTo('.rig-panel', { autoAlpha: 0, y: 60, rotate: -1.5 }, { autoAlpha: 1, y: 0, rotate: -0.4, duration: 0.8, ease: 'power3.out' }, 0)
      tl.fromTo('.gauge', { autoAlpha: 0, x: 20 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power3.out' }, 0.3)
      tl.fromTo('.rig-side', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.5)
      tl.set({}, {}, 10)
    },
    { scope: ref, dependencies: [hero.id] },
  )

  return (
    <Chapter ref={ref} id="rupture" tone="paper">
      <RuptureRig ref={rig} hero={hero} reduced={false} />
    </Chapter>
  )
}
