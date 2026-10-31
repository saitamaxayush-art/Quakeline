import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import landTopo from 'world-atlas/land-110m.json'
import {
  CanvasTexture,
  Color,
  DataTexture,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  NoColorSpace,
  PerspectiveCamera,
  Quaternion,
  RedFormat,
  RepeatWrapping,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  type Texture,
} from 'three'
import { CloudSun, Minus, Plus, RotateCcw } from 'lucide-react'
import { faceAngles, latLonToVec3 } from './globe'
import { Button } from './ui'
import { globeLabel } from './CloudLayer'
import type { Quake } from '../lib/types'
import { depthLabel, km, mag, timeAgo } from '../lib/format'
import { magStep, tokenColor } from '../lib/scales'
import { prefersReducedMotion } from '../lib/motion'
import { EQ_H, EQ_W } from '../lib/clouds/config'
import { useTimelineSnapshot, type CloudTimeline } from '../lib/clouds/timeline'

const FOV = 35

/**
 * The globe is built around the clouds: a low-contrast base (calm grey-teal ocean, warm land
 * one step lighter), near-white clouds with a soft shadow, and pulses with an ink outline on
 * top. Helicorder survives in the ink plate, the paper graticule and the thin edge.
 */
const SURFACE = {
  ocean: '#6f7d7e',
  land: '#a29a87',
  coast: '#3a3833',
  grid: '#f1ece2',
  edge: '#2a2926',
  atmosphere: '#dfe6e3',
  cloud: '#fbf9f4',
  cloudShadow: '#141312',
  ink: '#141312',
  plate: '#141312',
}
/** Width of the ink ring around each pulse, world units. */
const EDGE = 0.0022
/** "Dim clouds" multiplies the cloud opacity by this. */
const DIM = 0.38
const HOME_ZOOM = 3.5
const MIN_ZOOM = 1.55
const MAX_ZOOM = 4.6
const FOCUS_ZOOM = 2.5
const MAX_TILT = 1.25

interface Pose {
  yaw: number
  tilt: number
  zoom: number
}

/** Everything the pointer, keyboard and frame loop share. Mutable, never React state. */
interface Ctl extends Pose {
  vYaw: number
  vTilt: number
  zoomTarget: number
  flight: Pose | null
  dragging: boolean
  home: Pose
}

const clampTilt = (t: number) => Math.max(-MAX_TILT, Math.min(MAX_TILT, t))
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** Dot radius in world units (globe radius 1), from magnitude. */
const dotSize = (m: number | null) => 0.0048 + Math.pow(Math.max(m ?? 0, 0), 1.5) * 0.0019

interface PulseData {
  quakes: Quake[]
  /** Unit vectors, 3 per quake. */
  vec: Float32Array
  size: Float32Array
  strong: number[]
}

function buildData(quakes: Quake[]): PulseData {
  // Weak first, so strong events draw on top.
  const sorted = [...quakes].sort((a, b) => (a.mag ?? -9) - (b.mag ?? -9))
  const vec = new Float32Array(sorted.length * 3)
  const size = new Float32Array(sorted.length)
  const strong: number[] = []
  const v = new Vector3()
  sorted.forEach((q, i) => {
    latLonToVec3(q.lat, q.lon, 1, v)
    vec[i * 3] = v.x
    vec[i * 3 + 1] = v.y
    vec[i * 3 + 2] = v.z
    size[i] = dotSize(q.mag)
    if ((q.mag ?? 0) >= 4.5) strong.push(i)
  })
  return { quakes: sorted, vec, size, strong }
}

const ringVert = /* glsl */ `
attribute float aPhase;
uniform float uTime;
varying float vA;
varying vec3 vC;
void main() {
  float ph = fract(uTime * 0.42 + aPhase);
  vA = (1.0 - ph) * (1.0 - ph);
  #ifdef USE_INSTANCING_COLOR
    vC = instanceColor;
  #else
    vC = vec3(1.0);
  #endif
  vec3 p = position * (1.0 + ph * 2.4);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
}
`
const ringFrag = /* glsl */ `
varying float vA;
varying vec3 vC;
void main() {
  gl_FragColor = vec4(vC, vA * 0.9);
  #include <colorspace_fragment>
}
`

/* ---------- Surface: a quiet two-tone base, so the clouds are the brightest thing on the globe ---------- */

const surfaceVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`
const surfaceFrag = /* glsl */ `
uniform sampler2D uMask;
uniform float uHasMask;
uniform vec3 uOcean;
uniform vec3 uLand;
uniform vec3 uCoast;
uniform vec3 uGrid;
uniform vec3 uEdge;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vN;
varying vec3 vV;
float gridLine(float deg, float step) {
  float f = deg / step;
  float d = abs(fract(f - 0.5) - 0.5) / fwidth(f);
  return 1.0 - min(d, 1.0);
}
void main() {
  vec4 m = texture2D(uMask, vUv);
  float land = uHasMask * m.r;
  float coast = uHasMask * m.g;
  vec3 col = mix(uOcean, uLand, land);
  vec3 p = normalize(vPos);
  float lat = degrees(asin(clamp(p.y, -1.0, 1.0)));
  float lon = degrees(atan(-p.z, p.x));
  float grid = max(gridLine(lat, 30.0) * step(abs(lat), 75.0), gridLine(lon, 30.0) * step(abs(lat), 80.0));
  col = mix(col, uGrid, grid * 0.22);
  col = mix(col, uCoast, coast * 0.5);
  // Soft light from the camera: no night side, only a gentle fall-off toward the edge.
  float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  col *= 0.84 + 0.16 * ndv;
  // Thin engraved edge at the limb.
  col = mix(col, uEdge, (1.0 - smoothstep(0.0, 0.045, ndv)) * 0.55);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

/** Land (red) and coastline (green) drawn from the bundled Natural Earth 1:110m land, equirectangular. */
function makeLandMask() {
  const W = 2048
  const H = 1024
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const topo = landTopo as unknown as Topology<{ land: GeometryCollection }>
  const land = feature(topo, topo.objects.land)
  const path = geoPath(geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]), ctx)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  ctx.beginPath()
  path(land)
  ctx.fillStyle = 'rgb(255,0,0)'
  ctx.fill()
  ctx.globalCompositeOperation = 'lighter'
  ctx.beginPath()
  path(land)
  ctx.strokeStyle = 'rgb(0,255,0)'
  ctx.lineWidth = 1.6
  ctx.stroke()
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = NoColorSpace
  tex.anisotropy = 4
  return tex
}

function Surface({ low }: { low: boolean }) {
  const mask = useMemo(makeLandMask, [])
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: surfaceVert,
        fragmentShader: surfaceFrag,
        uniforms: {
          uMask: { value: mask },
          uHasMask: { value: mask ? 1 : 0 },
          uOcean: { value: new Color(SURFACE.ocean) },
          uLand: { value: new Color(SURFACE.land) },
          uCoast: { value: new Color(SURFACE.coast) },
          uGrid: { value: new Color(SURFACE.grid) },
          uEdge: { value: new Color(SURFACE.edge) },
        },
      }),
    [mask],
  )
  useEffect(
    () => () => {
      mat.dispose()
      mask?.dispose()
    },
    [mat, mask],
  )
  const seg = low ? 72 : 128
  return (
    <mesh material={mat}>
      <sphereGeometry args={[1, seg, seg / 2]} />
    </mesh>
  )
}

const atmoVert = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`
const atmoFrag = /* glsl */ `
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vV;
void main() {
  float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 6.0);
  gl_FragColor = vec4(uColor, rim * 0.7);
  #include <colorspace_fragment>
}
`

/** A thin atmosphere rim around the limb. */
function Atmosphere() {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        transparent: true,
        depthWrite: false,
        uniforms: { uColor: { value: new Color(SURFACE.atmosphere) } },
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh material={mat} renderOrder={1}>
      <sphereGeometry args={[1.018, 96, 48]} />
    </mesh>
  )
}

/* ---------- Clouds: near-white, strong alpha, a soft shadow beneath ---------- */

const cloudVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const cloudFrag = /* glsl */ `
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uMix;
uniform float uOpacity;
uniform float uShadow;
uniform vec3 uColor;
varying vec2 vUv;
float cov(vec2 uv) { return mix(texture2D(uA, uv).r, texture2D(uB, uv).r, uMix); }
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  if (uShadow > 0.5) {
    // Blurred and nudged, so a dark edge shows under one side of every cloud.
    vec2 t = vec2(2.5 / 1024.0, 2.5 / 512.0);
    vec2 o = vec2(0.0011, 0.0016);
    float c = (2.0 * cov(uv + o) + cov(uv + o + vec2(t.x, 0.0)) + cov(uv + o - vec2(t.x, 0.0))
      + cov(uv + o + vec2(0.0, t.y)) + cov(uv + o - vec2(0.0, t.y))) / 6.0;
    float a = smoothstep(0.08, 0.6, c);
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * 0.45 * uOpacity);
  } else {
    // Contrast curve on alpha: thin cloud still shows, thick cloud is close to opaque.
    float a = pow(smoothstep(0.07, 0.72, cov(uv)), 0.6);
    if (a < 0.01) discard;
    vec3 col = mix(uColor * 0.84, uColor, smoothstep(0.15, 0.7, a));
    gl_FragColor = vec4(col, a * uOpacity);
  }
  #include <colorspace_fragment>
}
`

/** The visitor's cloud settings, read every frame. */
interface CloudSettings {
  on: boolean
  opacity: number
  dim: boolean
}

/** What the cloud shells draw this frame. Written by CloudFrames, read by CloudShell. */
interface CloudState {
  a: Texture | null
  b: Texture | null
  mix: number
  /** Current opacity, eased toward the target. */
  opacity: number
}

function CloudShell({ state, shadow, low }: { state: CloudState; shadow: boolean; low: boolean }) {
  const mesh = useRef<Mesh>(null)
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: cloudVert,
        fragmentShader: cloudFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uA: { value: null },
          uB: { value: null },
          uMix: { value: 0 },
          uOpacity: { value: 0 },
          uShadow: { value: shadow ? 1 : 0 },
          uColor: { value: new Color(shadow ? SURFACE.cloudShadow : SURFACE.cloud) },
        },
      }),
    [shadow],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    m.visible = state.opacity > 0.004 && !!state.a
    if (!m.visible) return
    const u = mat.uniforms
    u.uA.value = state.a
    u.uB.value = state.b ?? state.a
    u.uMix.value = state.b ? state.mix : 0
    u.uOpacity.value = state.opacity
  })
  const seg = low ? 72 : 128
  return (
    <mesh ref={mesh} material={mat} renderOrder={shadow ? 2 : 3} visible={false}>
      <sphereGeometry args={[shadow ? 1.005 : 1.011, seg, seg / 2]} />
    </mesh>
  )
}

const Z = new Vector3(0, 0, 1)
const tmpV = new Vector3()
const tmpQ = new Quaternion()
const tmpS = new Vector3()
const tmpM = new Matrix4()

function place(mesh: InstancedMesh, i: number, d: PulseData, k: number, r: number, s: number) {
  tmpV.set(d.vec[k * 3], d.vec[k * 3 + 1], d.vec[k * 3 + 2])
  tmpQ.setFromUnitVectors(Z, tmpV)
  tmpV.multiplyScalar(r)
  tmpS.set(s, s, s)
  tmpM.compose(tmpV, tmpQ, tmpS)
  mesh.setMatrixAt(i, tmpM)
}

/**
 * The globe: surface, atmosphere, clouds and event pulses, turned together by the controller.
 * Draw order: surface, atmosphere, cloud shadow, clouds, then the pulses on top of everything.
 * Every layer above the surface is transparent (so renderOrder applies) and tests depth against
 * the surface, which hides the far side.
 */
function Planet({
  data,
  ctl,
  hover,
  selectedId,
  reduced,
  cloud,
  low,
}: {
  data: PulseData
  ctl: Ctl
  hover: RefObject<number>
  selectedId: string | null
  reduced: boolean
  cloud: CloudState
  low: boolean
}) {
  const group = useRef<Group>(null)
  const fill = useRef<InstancedMesh>(null)
  const edge = useRef<InstancedMesh>(null)
  const rings = useRef<InstancedMesh>(null)
  const marker = useRef<Mesh>(null)
  const shownHover = useRef(-1)
  const n = data.quakes.length

  const palette = useMemo(() => [0, 1, 2, 3, 4].map((s) => new Color(tokenColor(`--mag-${s as 0 | 1 | 2 | 3 | 4}`) || '#8c877e')), [])
  const ink = useMemo(() => new Color(SURFACE.ink), [])
  const ringMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: ringVert,
        fragmentShader: ringFrag,
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
      }),
    [],
  )
  useEffect(() => () => ringMat.dispose(), [ringMat])

  const selIndex = useMemo(() => (selectedId ? data.quakes.findIndex((q) => q.id === selectedId) : -1), [data, selectedId])

  useLayoutEffect(() => {
    const f = fill.current
    const e = edge.current
    if (!f || !e) return
    for (let i = 0; i < n; i++) {
      const s = data.size[i]
      place(f, i, data, i, 1.0135, s)
      place(e, i, data, i, 1.013, s + EDGE)
      f.setColorAt(i, palette[magStep(data.quakes[i].mag) ?? 0])
    }
    f.instanceMatrix.needsUpdate = true
    e.instanceMatrix.needsUpdate = true
    if (f.instanceColor) f.instanceColor.needsUpdate = true
    shownHover.current = -1

    const r = rings.current
    if (r) {
      const phase = new Float32Array(data.strong.length)
      data.strong.forEach((k, i) => {
        place(r, i, data, k, 1.0132, data.size[k])
        r.setColorAt(i, palette[magStep(data.quakes[k].mag) ?? 0])
        phase[i] = (k * 0.618) % 1
      })
      r.geometry.setAttribute('aPhase', new InstancedBufferAttribute(phase, 1))
      r.instanceMatrix.needsUpdate = true
      if (r.instanceColor) r.instanceColor.needsUpdate = true
    }
  }, [data, n, palette])

  useFrame((state) => {
    group.current?.rotation.set(ctl.tilt, ctl.yaw, 0)
    ringMat.uniforms.uTime.value = state.clock.elapsedTime
    // Grow the dot under the pointer.
    const f = fill.current
    const e = edge.current
    const h = hover.current ?? -1
    if (f && e && h !== shownHover.current) {
      const prev = shownHover.current
      if (prev >= 0 && prev < n) {
        place(f, prev, data, prev, 1.0135, data.size[prev])
        place(e, prev, data, prev, 1.013, data.size[prev] + EDGE)
      }
      if (h >= 0 && h < n) {
        const s = data.size[h] * 1.7 + 0.004
        place(f, h, data, h, 1.0137, s)
        place(e, h, data, h, 1.0133, s + EDGE * 1.4)
      }
      shownHover.current = h
      f.instanceMatrix.needsUpdate = true
      e.instanceMatrix.needsUpdate = true
    }
    const m = marker.current
    if (m) {
      m.visible = selIndex >= 0
      if (selIndex >= 0) {
        tmpV.set(data.vec[selIndex * 3], data.vec[selIndex * 3 + 1], data.vec[selIndex * 3 + 2])
        m.quaternion.setFromUnitVectors(Z, tmpV)
        m.position.copy(tmpV).multiplyScalar(1.014)
        const base = data.size[selIndex] * 2 + 0.012
        m.scale.setScalar(base * (reduced ? 1 : 1 + Math.sin(state.clock.elapsedTime * 3) * 0.12))
      }
    }
  })

  return (
    <group ref={group}>
      <Surface low={low} />
      <Atmosphere />
      <CloudShell state={cloud} shadow low={low} />
      <CloudShell state={cloud} shadow={false} low={low} />
      {n > 0 && (
        <>
          <instancedMesh key={`e${n}`} ref={edge} args={[undefined, undefined, n]} renderOrder={4} frustumCulled={false}>
            <circleGeometry args={[1, 20]} />
            <meshBasicMaterial color={ink} toneMapped={false} depthWrite={false} transparent />
          </instancedMesh>
          <instancedMesh key={`f${n}`} ref={fill} args={[undefined, undefined, n]} renderOrder={5} frustumCulled={false}>
            <circleGeometry args={[1, 20]} />
            <meshBasicMaterial toneMapped={false} depthWrite={false} transparent />
          </instancedMesh>
        </>
      )}
      {!reduced && data.strong.length > 0 && (
        <instancedMesh
          key={`r${data.strong.length}`}
          ref={rings}
          args={[undefined, ringMat, data.strong.length]}
          renderOrder={6}
          frustumCulled={false}
        >
          <ringGeometry args={[0.84, 1, 40]} />
        </instancedMesh>
      )}
      <mesh ref={marker} renderOrder={7} visible={false}>
        <ringGeometry args={[0.78, 1, 48]} />
        <meshBasicMaterial color={ink} toneMapped={false} depthWrite={false} transparent />
      </mesh>
    </group>
  )
}

/** Turns each loaded cloud frame into a GPU texture once, then feeds the timeline's blend to the cloud shell. */
function CloudFrames({ tl, settings, cloud }: { tl: CloudTimeline; settings: RefObject<CloudSettings>; cloud: CloudState }) {
  const gl = useThree((s) => s.gl)
  const snap = useTimelineSnapshot(tl)
  const cache = useRef(new Map<Uint8Array, DataTexture>())

  const textures = useMemo(
    () =>
      snap.frames.map((f) => {
        if (!f.eq) return null
        let tex = cache.current.get(f.eq)
        if (!tex) {
          tex = new DataTexture(f.eq, EQ_W, EQ_H, RedFormat, UnsignedByteType)
          tex.minFilter = LinearFilter
          tex.magFilter = LinearFilter
          tex.wrapS = RepeatWrapping
          tex.generateMipmaps = false
          tex.needsUpdate = true
          // Upload now, not on the first frame that shows it, so playback never waits on the GPU.
          gl.initTexture(tex)
          cache.current.set(f.eq, tex)
        }
        return tex
      }),
    [snap.frames, gl],
  )

  useEffect(() => {
    const live = new Set(textures)
    for (const [k, t] of cache.current)
      if (!live.has(t)) {
        t.dispose()
        cache.current.delete(k)
      }
  }, [textures])
  useEffect(() => {
    const c = cache.current
    return () => {
      c.forEach((t) => t.dispose())
      c.clear()
    }
  }, [])

  useFrame((_, dt) => {
    const v = tl.view
    cloud.a = textures[v.a] ?? null
    cloud.b = v.b !== v.a ? (textures[v.b] ?? null) : null
    cloud.mix = v.t
    const cfg = settings.current
    const target = cfg.on && cloud.a ? cfg.opacity * (cfg.dim ? DIM : 1) : 0
    cloud.opacity += (target - cloud.opacity) * (1 - Math.exp(-Math.min(dt, 0.1) * 6))
  })
  return null
}

/**
 * Moves the camera from the shared controller and eases flights and inertia. Runs before every
 * other frame callback (priority -1), so each frame draws the pose computed for it.
 */
function Rig({
  ctl,
  camRef,
  reduced,
  onMove,
}: {
  ctl: Ctl
  camRef: RefObject<PerspectiveCamera | null>
  reduced: boolean
  onMove: () => void
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  useEffect(() => {
    camRef.current = camera
  }, [camera, camRef])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const f = ctl.flight
    let moving = false
    if (f) {
      const k = reduced ? 1 : 1 - Math.exp(-dt * 4.2)
      const dy = wrapAngle(f.yaw - ctl.yaw)
      ctl.yaw += dy * k
      ctl.tilt += (f.tilt - ctl.tilt) * k
      ctl.zoomTarget = ctl.zoomTarget + (f.zoom - ctl.zoomTarget) * k
      if (Math.abs(dy) < 0.001 && Math.abs(f.tilt - ctl.tilt) < 0.001 && Math.abs(f.zoom - ctl.zoomTarget) < 0.002) ctl.flight = null
      moving = true
    } else if (!ctl.dragging) {
      ctl.yaw += ctl.vYaw * dt
      ctl.tilt = clampTilt(ctl.tilt + ctl.vTilt * dt)
      const decay = Math.exp(-dt * 3.6)
      ctl.vYaw *= decay
      ctl.vTilt *= decay
      if (Math.abs(ctl.vYaw) + Math.abs(ctl.vTilt) > 0.02) moving = true
      else ctl.vYaw = ctl.vTilt = 0
    }
    const dz = ctl.zoomTarget - ctl.zoom
    ctl.zoom += reduced ? dz : dz * (1 - Math.exp(-dt * 9))
    if (Math.abs(dz) > 0.003) moving = true
    if (moving) onMove()

    // Narrow plates pull back so the globe still fits the width.
    const k = Math.max(1, 1.08 / (size.width / size.height))
    camera.position.set(0, 0, 1 + (ctl.zoom - 1) * k)
    camera.lookAt(0, 0, 0)
  }, -1)
  return null
}

const euler = new Euler()
const rot = new Matrix4()
const proj = new Vector3()

export default function GlobeView({
  quakes,
  selectedId,
  onSelect,
  tl,
  cloudsOn,
  onShowClouds,
  cloudOpacity,
  dimClouds,
}: {
  quakes: Quake[]
  selectedId: string | null
  onSelect: (q: Quake) => void
  tl: CloudTimeline
  cloudsOn: boolean
  onShowClouds: () => void
  cloudOpacity: number
  dimClouds: boolean
}) {
  const plate = useRef<HTMLDivElement>(null)
  const camRef = useRef<PerspectiveCamera | null>(null)
  const hover = useRef(-1)
  const reduced = useMemo(prefersReducedMotion, [])
  const low = useMemo(
    () => typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700),
    [],
  )
  const data = useMemo(() => buildData(quakes), [quakes])
  const cloud = useMemo<CloudState>(() => ({ a: null, b: null, mix: 0, opacity: 0 }), [])
  const settings = useRef<CloudSettings>({ on: cloudsOn, opacity: cloudOpacity, dim: dimClouds })
  settings.current = { on: cloudsOn, opacity: cloudOpacity, dim: dimClouds }
  const snap = useTimelineSnapshot(tl)
  const frameNow = snap.index >= 0 ? snap.frames[snap.index] : undefined
  const label = cloudsOn && frameNow?.status === 'ready' ? globeLabel(frameNow) : null

  // Start facing the strongest event in the results, tilted no further than 30 degrees.
  const ctl = useRef<Ctl | null>(null)
  if (!ctl.current) {
    const top = quakes.reduce<Quake | null>((m, q) => (!m || (q.mag ?? -9) > (m.mag ?? -9) ? q : m), null)
    const a = top ? faceAngles(Math.max(-30, Math.min(30, top.lat)), top.lon) : faceAngles(15, -150)
    const home = { yaw: a.y, tilt: a.x, zoom: HOME_ZOOM }
    ctl.current = { ...home, vYaw: 0, vTilt: 0, zoomTarget: HOME_ZOOM, flight: null, dragging: false, home }
  }
  const c = ctl.current

  // If the globe opened before the feed arrived, turn to the strongest event once it does,
  // unless the visitor has already moved it.
  const homed = useRef(quakes.length > 0)
  useEffect(() => {
    if (homed.current || quakes.length === 0) return
    homed.current = true
    const top = quakes.reduce<Quake>((m, q) => ((q.mag ?? -9) > (m.mag ?? -9) ? q : m), quakes[0])
    const a = faceAngles(Math.max(-30, Math.min(30, top.lat)), top.lon)
    c.home = { yaw: a.y, tilt: a.x, zoom: HOME_ZOOM }
    if (!c.dragging && !c.flight && c.vYaw === 0 && c.vTilt === 0) c.flight = { ...c.home }
  }, [quakes, c])

  const [tip, setTip] = useState<{ q: Quake; x: number; y: number } | null>(null)
  const tipShown = useRef(false)
  const [active, setActive] = useState(true)

  // Render only while the plate is on screen and the tab is visible.
  useEffect(() => {
    const el = plate.current
    if (!el) return
    let onScreen = true
    const update = () => setActive(onScreen && !document.hidden)
    // A margin, so drawing resumes just before the plate scrolls in and no stale frame shows.
    const io = new IntersectionObserver(
      ([e]) => {
        onScreen = e.isIntersecting
        update()
      },
      { rootMargin: '200px 0px' },
    )
    io.observe(el)
    document.addEventListener('visibilitychange', update)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  // The camera eases to the event whenever one is opened, from here or from anywhere else.
  useEffect(() => {
    if (!selectedId) return
    const q = quakes.find((e) => e.id === selectedId)
    if (!q) return
    const a = faceAngles(q.lat, q.lon)
    c.vYaw = c.vTilt = 0
    c.flight = { yaw: a.y, tilt: clampTilt(a.x), zoom: Math.min(c.zoomTarget, FOCUS_ZOOM) }
  }, [selectedId, quakes, c])

  const hideTip = useCallback(() => {
    if (tipShown.current) {
      tipShown.current = false
      hover.current = -1
      setTip(null)
    }
  }, [])

  /** Nearest visible event to a point on the plate, in CSS pixels. */
  const pick = useCallback(
    (px: number, py: number, slop: number) => {
      const cam = camRef.current
      const el = plate.current
      if (!cam || !el) return -1
      const w = el.clientWidth
      const h = el.clientHeight
      euler.set(c.tilt, c.yaw, 0, 'XYZ')
      rot.makeRotationFromEuler(euler)
      const camZ = cam.position.z
      const pxPerUnit = h / 2 / (Math.tan((FOV * Math.PI) / 360) * Math.max(0.2, camZ - 1))
      let best = -1
      let bestD = Infinity
      for (let i = 0; i < data.quakes.length; i++) {
        proj.set(data.vec[i * 3], data.vec[i * 3 + 1], data.vec[i * 3 + 2]).applyMatrix4(rot)
        // On the near side of the horizon only.
        if (proj.z * camZ < 1.02) continue
        proj.project(cam)
        const sx = ((proj.x + 1) / 2) * w
        const sy = ((1 - proj.y) / 2) * h
        const d = (sx - px) ** 2 + (sy - py) ** 2
        const r = Math.max(slop, data.size[i] * pxPerUnit + 5)
        // Ties go to the later (stronger) event, which is drawn on top.
        if (d <= r * r && d <= bestD) {
          bestD = d
          best = i
        }
      }
      return best
    },
    [c, data],
  )

  const screenOf = useCallback(
    (i: number) => {
      const cam = camRef.current
      const el = plate.current
      if (!cam || !el) return null
      euler.set(c.tilt, c.yaw, 0, 'XYZ')
      rot.makeRotationFromEuler(euler)
      proj.set(data.vec[i * 3], data.vec[i * 3 + 1], data.vec[i * 3 + 2]).applyMatrix4(rot).project(cam)
      return { x: ((proj.x + 1) / 2) * el.clientWidth, y: ((1 - proj.y) / 2) * el.clientHeight }
    },
    [c, data],
  )

  // Pointer input: one pointer drags, two pinch. A press that barely moves is a click.
  useEffect(() => {
    const el = plate.current
    if (!el) return
    const pts = new Map<number, { x: number; y: number }>()
    let down: { x: number; y: number; t: number; moved: boolean } | null = null
    let pinch = 0
    let lastMove = 0
    let hoverRaf = 0

    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const radPerPx = () => {
      const cam = camRef.current
      const camZ = cam ? cam.position.z : c.zoom
      return (Math.max(0.15, camZ - 1) * Math.tan((FOV * Math.PI) / 360)) / (el.clientHeight / 2)
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      // Buttons on the plate (zoom, reset, show clouds) keep their own clicks: capturing the
      // pointer here would retarget the click to the plate.
      if ((e.target as Element).closest('button, a, input, label')) return
      el.setPointerCapture(e.pointerId)
      pts.set(e.pointerId, local(e))
      c.flight = null
      c.vYaw = c.vTilt = 0
      hideTip()
      if (pts.size === 1) {
        const p = local(e)
        down = { x: p.x, y: p.y, t: performance.now(), moved: false }
        c.dragging = true
        lastMove = performance.now()
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
        if (down) down.moved = true
      }
    }

    const onMove = (e: PointerEvent) => {
      const p = local(e)
      if (!pts.has(e.pointerId)) {
        // Plain hover: look for an event under the pointer, once per animation frame.
        if (e.pointerType !== 'mouse') return
        cancelAnimationFrame(hoverRaf)
        hoverRaf = requestAnimationFrame(() => {
          if (c.flight || Math.abs(c.vYaw) + Math.abs(c.vTilt) > 0.02) return
          const i = pick(p.x, p.y, 9)
          hover.current = i
          el.style.cursor = i >= 0 ? 'pointer' : 'grab'
          if (i >= 0) {
            const s = screenOf(i)
            if (s) {
              tipShown.current = true
              setTip((t) => (t && t.q.id === data.quakes[i].id ? t : { q: data.quakes[i], x: s.x, y: s.y }))
            }
          } else hideTip()
        })
        return
      }
      const prev = pts.get(e.pointerId)!
      pts.set(e.pointerId, p)
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch > 0 && d > 0) c.zoomTarget = clampZoom(c.zoomTarget * (pinch / d))
        pinch = d
        return
      }
      const dx = p.x - prev.x
      const dy = p.y - prev.y
      if (down && Math.hypot(p.x - down.x, p.y - down.y) > 5) down.moved = true
      const k = radPerPx()
      c.yaw += dx * k
      c.tilt = clampTilt(c.tilt + dy * k)
      const now = performance.now()
      const dtm = Math.max(8, now - lastMove) / 1000
      lastMove = now
      // Smoothed velocity, used for inertia on release.
      c.vYaw = c.vYaw * 0.6 + ((dx * k) / dtm) * 0.4
      c.vTilt = c.vTilt * 0.6 + ((dy * k) / dtm) * 0.4
      el.style.cursor = 'grabbing'
    }

    const onUp = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return
      pts.delete(e.pointerId)
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      if (pts.size === 0) {
        c.dragging = false
        el.style.cursor = 'grab'
        // A pause before release means no throw.
        if (performance.now() - lastMove > 90 || reduced) c.vYaw = c.vTilt = 0
        if (down && !down.moved && e.type === 'pointerup') {
          c.vYaw = c.vTilt = 0
          const p = local(e)
          const i = pick(p.x, p.y, e.pointerType === 'mouse' ? 9 : 18)
          if (i >= 0) onSelect(data.quakes[i])
        }
        down = null
      } else if (pts.size === 1) {
        pinch = 0
      }
    }

    const onLeave = () => {
      if (pts.size === 0) {
        hover.current = -1
        hideTip()
      }
    }

    // Wheel zooms the globe for the whole gesture. Only a gesture that starts fully zoomed out and
    // scrolls down is handed to the page, so scrolling past the globe still works and a zoom never
    // turns into a sudden page jump halfway through.
    let lastWheel = 0
    let passThrough = false
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey === false && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      const now = performance.now()
      if (now - lastWheel > 260) passThrough = e.deltaY > 0 && c.zoomTarget >= MAX_ZOOM - 1e-3
      lastWheel = now
      if (passThrough) return
      const next = clampZoom(c.zoomTarget * Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)))
      e.preventDefault()
      e.stopPropagation()
      c.flight = null
      c.zoomTarget = next
      hideTip()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('wheel', onWheel, { passive: false })
    const noMenu = (e: Event) => e.preventDefault()
    el.addEventListener('contextmenu', noMenu)
    return () => {
      cancelAnimationFrame(hoverRaf)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', noMenu)
    }
  }, [c, data, pick, screenOf, hideTip, onSelect, reduced])

  const fly = useCallback(
    (p: Partial<Pose>) => {
      c.vYaw = c.vTilt = 0
      c.flight = { yaw: p.yaw ?? c.yaw, tilt: clampTilt(p.tilt ?? c.tilt), zoom: clampZoom(p.zoom ?? c.zoomTarget) }
      hideTip()
    },
    [c, hideTip],
  )
  const reset = useCallback(() => fly(c.home), [c, fly])

  const onKey = (e: KeyboardEvent) => {
    const step = 0.35
    const map: Record<string, () => void> = {
      ArrowLeft: () => fly({ yaw: c.yaw + step }),
      ArrowRight: () => fly({ yaw: c.yaw - step }),
      ArrowUp: () => fly({ tilt: c.tilt + step }),
      ArrowDown: () => fly({ tilt: c.tilt - step }),
      '+': () => fly({ zoom: c.zoomTarget / 1.25 }),
      '=': () => fly({ zoom: c.zoomTarget / 1.25 }),
      '-': () => fly({ zoom: c.zoomTarget * 1.25 }),
      '0': reset,
    }
    const fn = map[e.key]
    if (fn) {
      e.preventDefault()
      fn()
    }
  }

  // A tooltip would point at the wrong place once the globe turns under it.
  const onMove = useCallback(() => {
    if (tipShown.current) hideTip()
  }, [hideTip])

  return (
    <div className="globe-wrap">
      <div
        ref={plate}
        className="globe-plate"
        tabIndex={0}
        role="application"
        aria-roledescription="interactive globe"
        aria-label={`Globe with ${quakes.length.toLocaleString('en')} events. Arrow keys turn it, plus and minus zoom, 0 resets. The list below has the same events as text.`}
        onKeyDown={onKey}
      >
        <Canvas
          flat
          frameloop={active ? 'always' : 'never'}
          dpr={[1, low ? 1.5 : 2]}
          camera={{ fov: FOV, near: 0.1, far: 20, position: [0, 0, HOME_ZOOM] }}
          gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
          aria-hidden="true"
        >
          <color attach="background" args={[SURFACE.plate]} />
          <Planet data={data} ctl={c} hover={hover} selectedId={selectedId} reduced={reduced} cloud={cloud} low={low} />
          <CloudFrames tl={tl} settings={settings} cloud={cloud} />
          <Rig ctl={c} camRef={camRef} reduced={reduced} onMove={onMove} />
        </Canvas>

        {cloudsOn ? (
          label && (
            <p className="globe-label mono" aria-live="polite">
              <span>Clouds, {label.time}</span>
              <span className="globe-label-src">{label.source}</span>
            </p>
          )
        ) : (
          <div className="globe-show">
            <Button variant="light" size="sm" icon={<CloudSun size={15} />} onClick={onShowClouds}>
              Show clouds
            </Button>
          </div>
        )}

        {tip && (
          <div className="viz-tip globe-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
            <strong>M{mag(tip.q.mag)}</strong>
            <span>{tip.q.place}</span>
            <small>
              {timeAgo(tip.q.time)} · {depthLabel(tip.q.depth)}, {km(tip.q.depth)} deep
            </small>
          </div>
        )}

        <div className="globe-tools">
          <Button variant="light" size="sm" aria-label="Zoom in" icon={<Plus size={16} />} onClick={() => fly({ zoom: c.zoomTarget / 1.3 })} />
          <Button variant="light" size="sm" aria-label="Zoom out" icon={<Minus size={16} />} onClick={() => fly({ zoom: c.zoomTarget * 1.3 })} />
          <Button variant="light" size="sm" className="globe-reset" aria-label="Reset view" icon={<RotateCcw size={15} />} onClick={reset}>
            Reset view
          </Button>
        </div>
      </div>
      <p className="globe-hint mono" aria-hidden="true">
        {low ? 'Drag to turn. Pinch to zoom. Tap a dot for details.' : 'Drag to turn. Scroll to zoom.'}
      </p>
    </div>
  )
}
