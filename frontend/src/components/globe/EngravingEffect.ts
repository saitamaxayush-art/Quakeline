import { Effect } from 'postprocessing'
import { Color, Uniform } from 'three'

/**
 * Screen-space engraving. Luminance becomes angled line hatching (up to four layers),
 * a Sobel pass adds ink edges, lines wobble a little like a hand-cut plate, and paper
 * grain sits on top. Pixels the scene renders in strong red keep the spot colour.
 *
 * uInvert = 0 draws ink lines on paper, 1 draws paper lines on ink.
 */
const fragment = /* glsl */ `
uniform vec3 uInk;
uniform vec3 uPaper;
uniform vec3 uRed;
uniform float uInvert;
uniform float uTime;
uniform float uLayers;
uniform float uScale;
uniform float uEdge;
uniform float uFlood;
uniform float uGamma;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Coverage of one family of parallel lines. tone: how much ink this pixel wants.
float hatch(vec2 p, float ang, float spacing, float tone, float start) {
  if (tone < start) return 0.0;
  vec2 n = vec2(-sin(ang), cos(ang));
  float v = dot(p, n) / spacing;
  float f = abs(fract(v) - 0.5) * 2.0;           // 0 at line centre, 1 between lines
  float w = clamp((tone - start) * 1.5 + 0.12, 0.0, 0.95);
  float aa = 1.4 / spacing;
  return 1.0 - smoothstep(w - aa, w + aa, f);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = uv * resolution / uScale;
  float t = floor(uTime * 6.0) / 6.0;            // lines "boil" at 6 fps, like redrawn frames
  vec2 wob = vec2(noise(px * 0.018 + t * 0.7), noise(px * 0.018 + 9.1 - t * 0.5)) * 2.0 - 1.0;
  vec2 p = px + wob * 1.3;

  vec3 c = inputColor.rgb;
  float l = pow(clamp(luma(c), 0.0, 1.0), uGamma);
  float tone = mix(1.0 - l, l, uInvert);

  float ink = 0.0;
  ink = max(ink, hatch(p, 0.785, 5.0, tone, 0.14));
  ink = max(ink, hatch(p, -0.785, 6.0, tone, 0.38));
  if (uLayers > 2.5) {
    ink = max(ink, hatch(p, 0.0, 4.0, tone, 0.6));
    ink = max(ink, hatch(p, 1.571, 5.0, tone, 0.8));
  }
  ink = max(ink, smoothstep(0.9, 0.97, tone));

  // Ink edges from luminance.
  vec2 tx = uScale / resolution;
  float tl = luma(texture2D(inputBuffer, uv + tx * vec2(-1.0, 1.0)).rgb);
  float tc = luma(texture2D(inputBuffer, uv + tx * vec2(0.0, 1.0)).rgb);
  float tr = luma(texture2D(inputBuffer, uv + tx * vec2(1.0, 1.0)).rgb);
  float ml = luma(texture2D(inputBuffer, uv + tx * vec2(-1.0, 0.0)).rgb);
  float mr = luma(texture2D(inputBuffer, uv + tx * vec2(1.0, 0.0)).rgb);
  float bl = luma(texture2D(inputBuffer, uv + tx * vec2(-1.0, -1.0)).rgb);
  float bc = luma(texture2D(inputBuffer, uv + tx * vec2(0.0, -1.0)).rgb);
  float br = luma(texture2D(inputBuffer, uv + tx * vec2(1.0, -1.0)).rgb);
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float edge = smoothstep(0.32, 0.75, length(vec2(gx, gy)));
  ink = max(ink, edge * uEdge);

  vec3 bg = mix(uPaper, uInk, uInvert);
  vec3 fg = mix(uInk, uPaper, uInvert);
  bg = mix(bg, uRed, uFlood);
  vec3 col = mix(bg, fg, ink);

  // Spot colour survives the monochrome pass.
  float redness = c.r - max(c.g, c.b);
  col = mix(col, uRed, smoothstep(0.35, 0.6, redness));

  float grain = hash(floor(uv * resolution) + t);
  col *= 1.0 - (grain - 0.5) * 0.07;
  outputColor = vec4(col, 1.0);
}
`

export interface EngravingOptions {
  ink?: string
  paper?: string
  red?: string
  invert?: number
  layers?: 2 | 4
  scale?: number
  edge?: number
}

export class EngravingEffect extends Effect {
  constructor({ ink = '#141312', paper = '#F1ECE2', red = '#C8261C', invert = 1, layers = 4, scale = 1, edge = 1 }: EngravingOptions = {}) {
    super('EngravingEffect', fragment, {
      uniforms: new Map<string, Uniform>([
        ['uInk', new Uniform(new Color(ink))],
        ['uPaper', new Uniform(new Color(paper))],
        ['uRed', new Uniform(new Color(red))],
        ['uInvert', new Uniform(invert)],
        ['uTime', new Uniform(0)],
        ['uLayers', new Uniform(layers)],
        ['uScale', new Uniform(scale)],
        ['uEdge', new Uniform(edge)],
        ['uFlood', new Uniform(0)],
        ['uGamma', new Uniform(1)],
      ]),
    })
  }

  set(name: 'uInvert' | 'uTime' | 'uScale' | 'uEdge' | 'uFlood' | 'uLayers' | 'uGamma', value: number) {
    const u = this.uniforms.get(name)
    if (u) u.value = value
  }
}
