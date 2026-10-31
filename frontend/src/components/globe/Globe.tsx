import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from 'three'
import type { Quake } from '../../lib/types'
import { faceAngles, latLonToVec3 } from './math'
import { angleDelta, lerp, type GlobeFrame } from './frame'

export { createGlobeFrame, type GlobeFrame } from './frame'

export interface GlobeProps {
  quakes: Quake[]
  focus?: Quake | null
  frame: GlobeFrame
  /** Equirectangular Earth texture. */
  textureUrl: string
  /** Optional cloud texture (red channel = cover). Without it, procedural ink-blot clouds are drawn. */
  overlay?: Texture | null
  detail?: 'high' | 'low'
}

const IDLE_TILT = 0.38
const tmpM = new Matrix4()
const tmpV = new Vector3()
const RED = new Color(1, 0, 0)
const WHITE = new Color(1, 1, 1)

const cloudVert = /* glsl */ `
varying vec3 vPos;
varying vec2 vUv;
void main() {
  vPos = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const cloudFrag = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform float uUseOverlay;
uniform sampler2D uOverlay;
varying vec3 vPos;
varying vec2 vUv;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  float cover;
  if (uUseOverlay > 0.5) {
    cover = texture2D(uOverlay, vUv).r;
  } else {
    vec3 p = normalize(vPos) * 2.6 + vec3(uTime * 0.012, 0.0, uTime * 0.008);
    float n = fbm(p + fbm(p * 1.7) * 0.6);
    float band = 1.0 - abs(normalize(vPos).y) * 0.35;
    cover = smoothstep(0.6, 0.64, n * band);
  }
  if (cover < 0.01) discard;
  gl_FragColor = vec4(vec3(0.82), cover * uOpacity);
}
`

const ringVert = /* glsl */ `
varying vec3 vPos;
void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const ringFrag = /* glsl */ `
uniform vec3 uEpi;
uniform float uP;
uniform float uS;
varying vec3 vPos;
float band(float a, float r, float w) { return r <= 0.0 ? 0.0 : 1.0 - smoothstep(0.0, w, abs(a - r)); }
void main() {
  float a = acos(clamp(dot(normalize(vPos), uEpi), -1.0, 1.0));
  float p = band(a, uP, 0.012);
  for (int k = 1; k < 4; k++) p = max(p, band(a, uP - float(k) * 0.07, 0.006) * (0.7 - float(k) * 0.15));
  float s = band(a, uS, 0.016);
  if (p + s < 0.02) discard;
  vec3 col = s > p ? vec3(1.0, 0.0, 0.0) : vec3(1.0);
  gl_FragColor = vec4(col, max(p, s));
}
`

function graticule() {
  const pts: number[] = []
  const v = new Vector3()
  const push = (lat: number, lon: number) => {
    latLonToVec3(lat, lon, 1.002, v)
    pts.push(v.x, v.y, v.z)
  }
  for (let lat = -60; lat <= 60; lat += 30)
    for (let lon = -180; lon < 180; lon += 3) {
      push(lat, lon)
      push(lat, lon + 3)
    }
  for (let lon = -180; lon < 180; lon += 30)
    for (let lat = -90; lat < 90; lat += 3) {
      push(lat, lon)
      push(lat + 3, lon)
    }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pts, 3))
  return g
}

export default function Globe({ quakes, focus, frame, textureUrl, overlay, detail = 'high' }: GlobeProps) {
  const group = useRef<Group>(null)
  const dots = useRef<InstancedMesh>(null)
  const marker = useRef<Mesh>(null)
  const cloudMesh = useRef<Mesh>(null)
  const ringMesh = useRef<Mesh>(null)
  const earth = useTexture(textureUrl)
  earth.colorSpace = SRGBColorSpace
  earth.anisotropy = 4

  const grat = useMemo(graticule, [])
  const seg = detail === 'high' ? 96 : 56

  const cloudMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: cloudVert,
        fragmentShader: cloudFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uUseOverlay: { value: 0 },
          uOverlay: { value: null },
        },
      }),
    [],
  )
  useEffect(() => {
    cloudMat.uniforms.uOverlay.value = overlay ?? null
    cloudMat.uniforms.uUseOverlay.value = overlay ? 1 : 0
  }, [overlay, cloudMat])

  const epi = useMemo(() => (focus ? latLonToVec3(focus.lat, focus.lon, 1) : new Vector3(0, 0, 1)), [focus])
  const ringMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: ringVert,
        fragmentShader: ringFrag,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uEpi: { value: new Vector3() }, uP: { value: 0 }, uS: { value: 0 } },
      }),
    [],
  )
  useEffect(() => {
    ringMat.uniforms.uEpi.value.copy(epi)
  }, [epi, ringMat])

  // Quakes in time order, so "reveal" fills the globe the way the day happened.
  const ordered = useMemo(() => [...quakes].sort((a, b) => a.time - b.time), [quakes])
  const lastReveal = useRef(-1)

  useEffect(() => {
    const mesh = dots.current
    if (!mesh) return
    ordered.forEach((q, i) => mesh.setColorAt(i, (q.mag ?? 0) >= 6 ? RED : WHITE))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    lastReveal.current = -1
  }, [ordered])

  useEffect(() => () => {
    grat.dispose()
    cloudMat.dispose()
    ringMat.dispose()
  }, [grat, cloudMat, ringMat])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const f = frame
    // Rotation: blend from the idle spin pose to the pose that faces the focus event.
    const target = focus ? faceAngles(focus.lat, focus.lon) : { x: IDLE_TILT, y: f.spin }
    g.rotation.x = lerp(IDLE_TILT, target.x, f.focusMix)
    g.rotation.y = f.spin + angleDelta(f.spin, target.y) * f.focusMix
    g.position.x = f.x

    cloudMat.uniforms.uTime.value = state.clock.elapsedTime
    cloudMat.uniforms.uOpacity.value = f.clouds
    // Skip the cloud and wave shells entirely when they would draw nothing.
    if (cloudMesh.current) cloudMesh.current.visible = f.clouds > 0.004
    if (ringMesh.current) ringMesh.current.visible = f.ringP > 0 || f.ringS > 0
    ringMat.uniforms.uP.value = f.ringP
    ringMat.uniforms.uS.value = f.ringS

    if (marker.current) {
      const s = f.pulse * (1 + Math.sin(state.clock.elapsedTime * 3) * 0.15)
      marker.current.scale.setScalar(Math.max(s, 0.0001))
    }

    const mesh = dots.current
    if (mesh && Math.abs(f.reveal - lastReveal.current) > 0.002) {
      lastReveal.current = f.reveal
      const shown = Math.round(f.reveal * ordered.length)
      ordered.forEach((q, i) => {
        const s = i < shown ? 0.004 + Math.pow(Math.max(q.mag ?? 0, 0), 1.5) * 0.0016 : 0
        latLonToVec3(q.lat, q.lon, 1.004, tmpV)
        tmpM.makeScale(s, s, s).setPosition(tmpV)
        mesh.setMatrixAt(i, tmpM)
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[1, seg, seg / 2]} />
        <meshStandardMaterial map={earth} roughness={1} metalness={0} />
      </mesh>
      <lineSegments geometry={grat}>
        <lineBasicMaterial color="#9a958c" transparent opacity={0.3} />
      </lineSegments>
      <mesh ref={cloudMesh} material={cloudMat}>
        <sphereGeometry args={[1.014, seg, seg / 2]} />
      </mesh>
      <mesh ref={ringMesh} material={ringMat}>
        <sphereGeometry args={[1.007, seg, seg / 2]} />
      </mesh>
      {ordered.length > 0 && (
        <instancedMesh ref={dots} args={[undefined, undefined, ordered.length]} frustumCulled={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      )}
      {focus && (
        <mesh ref={marker} position={epi.clone().multiplyScalar(1.01)}>
          <sphereGeometry args={[0.022, 16, 12]} />
          <meshBasicMaterial color={RED} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
