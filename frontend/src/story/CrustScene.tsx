import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, ExtrudeGeometry, Group, InstancedMesh, Matrix4, Euler, Quaternion, Shape, Vector3, Mesh } from 'three'
import { stage } from './stage'
import { BOTTOM, TOP, crustMaxKm, depthToY, faultX } from './crust'
import { lerp } from '../components/globe/math'

/** Strata, top to bottom: relative thickness and grey value (grey becomes hatching density). */
const STRATA: [number, number][] = [
  [0.35, 1],
  [0.55, 0.78],
  [0.4, 0.94],
  [0.7, 0.64],
  [0.45, 0.88],
  [0.6, 0.56],
  [0.5, 0.8],
  [0.45, 0.62],
]
const W = 3.2
const DEPTH = 1.6
const SLIP = new Vector3(-0.32, -1, 0).normalize()
const GOUGE = 0.035

function slab(x0: (y: number) => number, x1: (y: number) => number, y0: number, y1: number) {
  const s = new Shape()
  s.moveTo(x0(y0), y0)
  s.lineTo(x1(y0), y0)
  s.lineTo(x1(y1), y1)
  s.lineTo(x0(y1), y1)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: DEPTH, bevelEnabled: false })
  g.translate(0, 0, -DEPTH / 2)
  return g
}

const tmpM = new Matrix4()
const tmpQ = new Quaternion()
const tmpE = new Euler()
const tmpP = new Vector3()
const tmpS = new Vector3()

export default function CrustScene({ depth, debrisCount }: { depth: number; debrisCount: number }) {
  const root = useRef<Group>(null)
  const right = useRef<Group>(null)
  const debris = useRef<InstancedMesh>(null)
  const hypo = useRef<Mesh>(null)

  const maxKm = crustMaxKm(depth)
  const hy = depthToY(depth, maxKm)
  const hx = faultX(hy)

  const layers = useMemo(() => {
    const total = STRATA.reduce((s, [t]) => s + t, 0)
    let y = TOP
    return STRATA.map(([t, grey]) => {
      const h = (t / total) * (TOP - BOTTOM)
      const y1 = y
      const y0 = y - h
      y = y0
      return {
        left: slab(() => -W, faultX, y0, y1),
        right: slab(faultX, () => W, y0, y1),
        color: new Color(grey, grey, grey),
      }
    })
  }, [])

  // The fault itself: a thin dark gouge zone so the break reads in the engraving.
  const gouge = useMemo(() => {
    const g = slab((y) => faultX(y) - GOUGE, (y) => faultX(y) + GOUGE, BOTTOM, TOP)
    g.scale(1, 1, 1.01)
    return g
  }, [])

  const seeds = useMemo(
    () =>
      Array.from({ length: debrisCount }, (_, i) => {
        const r = (n: number) => {
          const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
          return v - Math.floor(v)
        }
        const side = i % 2 ? 1 : -1
        return { x: side * (0.9 + r(1) * 2.4), z: 1 + r(2) * 2.2, start: 2.5 + r(3) * 2.5, speed: 5 + r(4) * 4, size: 0.04 + r(5) * 0.12, spin: 2 + r(6) * 6 }
      }),
    [debrisCount],
  )

  useFrame((state) => {
    const g = root.current
    if (!g) return
    g.visible = stage.scene === 'crust'
    if (!g.visible) return
    const c = stage.crust
    const cam = state.camera

    // Camera: comes down through the surface, settles level with the hypocentre.
    const shake = c.charge * c.charge * 0.035
    const t = state.clock.elapsedTime
    cam.position.set(
      lerp(0.2, hx + 0.7, c.pan) + Math.sin(t * 61) * shake,
      lerp(TOP + 2.4, hy + 0.9, c.pan) + Math.cos(t * 53) * shake,
      lerp(3.2, 6.4, c.pan),
    )
    cam.lookAt(lerp(0, hx + 0.3, c.pan), lerp(TOP - 0.2, hy + 0.1, c.pan), 0)

    // Loading bends the right block against the fault; release slips it down the fault.
    if (right.current) {
      right.current.position.copy(SLIP).multiplyScalar(c.slip * 0.34)
      right.current.position.x += c.charge * 0.02 * (1 - c.slip)
      right.current.rotation.z = -c.charge * 0.012 * (1 - c.slip)
    }
    if (hypo.current) hypo.current.scale.setScalar(1 + c.charge * 0.8 + Math.sin(t * 4) * 0.08)

    const mesh = debris.current
    if (mesh) {
      seeds.forEach((s, i) => {
        const y = s.start - c.debris * s.speed
        const on = c.debris > 0 && c.debris < 1 && y > BOTTOM - 1
        tmpE.set(c.debris * s.spin, c.debris * s.spin * 0.7, 0)
        tmpQ.setFromEuler(tmpE)
        tmpP.set(s.x + hx, y + (hy + 1), s.z)
        tmpS.setScalar(on ? s.size : 0)
        mesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS))
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={root} visible={false}>
      <directionalLight position={[-3, 4, 5]} intensity={2.4} />
      <ambientLight intensity={0.45} />
      <group>
        {layers.map((l, i) => (
          <mesh key={`l${i}`} geometry={l.left}>
            <meshStandardMaterial color={l.color} roughness={1} flatShading />
          </mesh>
        ))}
      </group>
      <group ref={right}>
        {layers.map((l, i) => (
          <mesh key={`r${i}`} geometry={l.right}>
            <meshStandardMaterial color={l.color} roughness={1} flatShading />
          </mesh>
        ))}
      </group>
      <mesh geometry={gouge}>
        <meshBasicMaterial color="#050505" />
      </mesh>
      <mesh ref={hypo} position={[hx, hy, DEPTH / 2 + 0.02]}>
        <sphereGeometry args={[0.075, 20, 14]} />
        <meshBasicMaterial color="#ff0000" toneMapped={false} />
      </mesh>
      <instancedMesh ref={debris} args={[undefined, undefined, debrisCount]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#8c8c8c" roughness={1} flatShading />
      </instancedMesh>
    </group>
  )
}
