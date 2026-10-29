import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { Color, Group, type Object3D } from 'three'
import { gsap } from 'gsap'
import { Globe, EngravingEffect, EARTH_TEXTURE } from '../components/globe'
import type { Quake } from '../lib/types'
import CrustScene from './CrustScene'
import { stage, updateStage } from './stage'

const INK = new Color('#000000')
const PAPER = new Color('#ffffff')

function GlobeScene({ quakes, focus, low }: { quakes: Quake[]; focus: Quake; low: boolean }) {
  const ref = useRef<Group>(null)
  useFrame(({ camera, size }) => {
    const on = stage.scene === 'globe'
    if (ref.current) ref.current.visible = on
    if (!on) return
    // On portrait screens the horizontal field is narrow: pull back so the globe still fits the width.
    const k = Math.max(1, 0.85 / (size.width / size.height))
    camera.position.set(0, 0, 1 + (stage.camDist - 1) * k)
    camera.lookAt(0, 0, 0)
  })
  return (
    <group ref={ref}>
      <directionalLight position={[-3, 2, 4]} intensity={2.6} />
      <ambientLight intensity={0.2} />
      <Globe quakes={quakes} focus={focus} frame={stage.globe} textureUrl={low ? EARTH_TEXTURE.low : EARTH_TEXTURE.high} detail={low ? 'low' : 'high'} />
    </group>
  )
}

function Engraving({ low }: { low: boolean }) {
  const effect = useMemo(() => new EngravingEffect({ layers: low ? 2 : 4, edge: low ? 0.7 : 1 }), [low])
  const { scene, gl } = useThree()
  useEffect(() => () => effect.dispose(), [effect])
  useFrame((state) => {
    effect.set('uInvert', stage.invert)
    effect.set('uFlood', stage.flood)
    // The composer works in linear light, where Blue Marble oceans are near zero. A low gamma
    // lifts them into a light hatch instead of solid ink; the crust greys are tuned for 1.
    effect.set('uGamma', stage.scene === 'globe' ? 0.26 : 1)
    effect.set('uTime', state.clock.elapsedTime)
    effect.set('uScale', gl.getPixelRatio())
    scene.background = stage.invert > 0.5 ? INK : PAPER
  })
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <primitive object={effect} />
    </EffectComposer>
  )
}

/** Compiles every material up front, so the first switch to the crust scene does not stall a scroll frame. */
function Warmup() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    const hidden: Object3D[] = []
    scene.traverse((o) => {
      if (!o.visible) {
        o.visible = true
        hidden.push(o)
      }
    })
    gl.compile(scene, camera)
    hidden.forEach((o) => (o.visible = false))
  }, [gl, scene, camera])
  return null
}

/** Runs the scroll mapping on the GSAP ticker and only asks for a frame while the stage is visible. */
function Driver({ wrap }: { wrap: RefObject<HTMLDivElement | null> }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const tick = (time: number) => {
      updateStage(time)
      const el = wrap.current
      if (el) el.style.opacity = String(stage.opacity)
      if (stage.opacity > 0.01 && !document.hidden) invalidate()
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [invalidate, wrap])
  return null
}

export default function StoryStage({ quakes, focus, low }: { quakes: Quake[]; focus: Quake; low: boolean }) {
  const wrap = useRef<HTMLDivElement>(null)
  return (
    <div className="stage-canvas" ref={wrap} aria-hidden="true">
      <Canvas
        frameloop="demand"
        dpr={[1, low ? 1.5 : 2]}
        camera={{ fov: 35, near: 0.01, far: 60, position: [0, 0, 3.6] }}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
      >
        <Suspense fallback={null}>
          <GlobeScene quakes={quakes} focus={focus} low={low} />
          <CrustScene depth={focus.depth} debrisCount={low ? 16 : 40} />
          <Engraving low={low} />
          <Warmup />
        </Suspense>
        <Driver wrap={wrap} />
      </Canvas>
    </div>
  )
}
