# Quakeline

One earthquake, from the rock to your screen. Quakeline opens with a scroll story about the strongest earthquake of the past 24 hours, then hands you a live explorer for every event the U.S. Geological Survey reports.

Every number on the site comes from the live USGS feed or is computed from it, and computed values are labelled "approx." on the page.

## Run it

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and production build into dist/
npm run preview    # serve the production build
```

Needs Node 18 or newer. No API key is required.

## Routes

| Route | What it is |
| --- | --- |
| `/` | The story. Old shared links such as `/?q=alaska&min=4` redirect to `/explore` with the same filters. |
| `/explore` | The dashboard: search, filters, sort, list and map views, event drawer. Every filter lives in the URL. |
| `/credits` | Every image, texture and dataset, with its source and licence. |
| `/privacy`, `/terms` | Legal pages. |

## The story

The protagonist is one real event: the strongest earthquake (by magnitude, `type === "earthquake"` only) in the `all_day` feed. If the day has none, the story falls back to `all_week` and its copy says "in the past 7 days".

| Ch. | Name | On screen | Length |
| --- | --- | --- | --- |
| 0 | Gate | "The ground moved N times in the past 24 hours." Two buttons: Follow one / Skip to data. A brush wipe, then the wordmark is written by a moving pen mask. | 1 screen |
| 1 | Orbit | Engraved globe turns to face the epicentre. Caption with magnitude, place, age and depth; instrument readout of coordinates, UTC time, magnitude type and review status. | 270vh |
| 2 | The dive | Camera falls toward the epicentre, through an ink portal, past falling rock and a title card ("10 km down"), into an engraved cross-section. A depth ruler counts down to the real hypocentre depth. | 340vh |
| 3 | Stress | Three overlapping comic panels: a Holmes engraving, strata that bend in three drawn states, a locked fault where hairline cracks appear. | 380vh |
| 4 | Rupture | The HOLD interaction (below). | 240vh |
| 5 | Waves | P and S fronts spread over the globe from the epicentre, with the time since rupture and both front distances. A seismogram draws itself; it is labelled as a drawing, not a recording. | 290vh |
| 6 | Stations | The nine nearest Global Seismographic Network stations light up in order of distance, with distance and approximate P arrival time. | 270vh |
| 7 | Published | The caption morphs into the event's dashboard row; the globe fills with every event of the day in time order; a poster card reads "The ground is never still." and opens the explorer. | 340vh |

**Chapter title cards.** Every chapter opens with a card: the number in the display face and the name in uppercase mono, drawn in by an ink-brush stroke when the chapter is entered and held for the first fifth of the chapter's scroll before the scene starts (`chapterTimeline` in `src/story/chapters/shared.tsx`).

**Chapter rail.** `src/story/ChapterRail.tsx`: a thin vertical rail on the right on desktop, a bar under the header on phones. Eight ticks (Ch. 0 to 7), the current chapter number and name, and progress inside the active chapter. Ticks scroll to their chapter with Lenis; Ch. 0 brings back the gate question. Hidden while the gate is up.

### Ch. 4, the HOLD interaction

`src/story/RuptureRig.tsx`. Built so a first-time visitor knows what to do without reading a paragraph.

- **Set-up:** "Press and hold to load the fault" ("Touch and hold" on touch screens) next to the round HOLD button, with "or hold Space". An engraved diagram of two rock blocks meeting at a fault, arrows pushing them in opposite directions, and the locked section marked in red. A rectangular STRESS gauge beside it starts at 0%. The gauge is a progress meter only; it shows no physical units.
- **Holding:** the gauge fills over 2.5 s on an accelerating curve. In sync, the arrows grow, the layers bend more and more near the fault (six pre-drawn states cross-faded, so only opacity and transforms animate), hairline cracks spread from the locked section and a light vibration builds. The status line reads "Stress building" up to 70%, then "The fault is about to slip". Page scroll is locked for the length of the hold.
- **Early release:** the bend relaxes, the gauge drains and the status reads "Not enough stress yet. Hold longer." Nothing breaks.
- **At 100%** the rupture fires without letting go: the blocks snap past each other along the fault and the layers spring back straight (elastic rebound), one screen jolt, red floods the frame behind the diagram, wave rings leave the hypocentre and the gauge drains. Then: "The fault slipped. The stored strain was released as seismic waves." and, from the live feed, "That is what happened at M[mag], [place]." Scroll unlocks and a "Scroll to follow the waves" cue appears.
- **Input:** mouse, touch (pointer capture, no context menu), Space anywhere while the diagram is on screen, Enter or Space on the focused button. The button has an accessible name and every stage change is announced through an `aria-live` region. A "Skip and show the rupture" link plays it without holding.
- **Replay:** scrolling back above the chapter resets the scene so it can be held again.
- **Reduced motion:** the same rig appears in the still story; stages switch as still frames, with no vibration or jolt.

The rig was checked against a simulated first visit (a reviewer shown only the screenshots). Its notes led to removing a second, redundant gauge, a dot over the HOLD label, red-on-red status text and a stray marker in the diagram, and to draining the gauge after the rupture so it agrees with the caption.

With `prefers-reduced-motion`, the story is a still, numbered sequence of panels with the same facts and a "Go to the data" link. No WebGL is loaded.

### What is computed, and how

- **P arrival times** (ch. 5 and 6): great-circle distance, then linear interpolation in a table of P travel times read from the IASP91 model. Beyond 100 degrees the direct P wave is in the core shadow, and the site says so instead of giving a time.
- **S front** (ch. 5): drawn at 0.55 of the P front's angular distance, which is close to the real ratio at teleseismic distances. Distances are shown, not S arrival times.
- **Depth bands**: the USGS convention of shallow (under 70 km), intermediate (70 to 300 km) and deep (over 300 km).

## Visual system: Helicorder

Drum seismograph paper and ink. Tokens live at the top of `src/styles/global.css`.

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--paper` | `#F1ECE2` | Background | |
| `--ink` | `#141312` | Text and linework | 15.76 on paper |
| `--graphite` | `#6E6A63` | Secondary text, hatching | 4.57 on paper |
| `--red` | `#C8261C` | The only accent: M6+ events, highlighted caption words, focus, the rupture | 4.76 on paper |
| `--ochre` | `#A9884F` | Strata fills only, never text | |
| `--graphite-on-ink` | `#A39E95` | Secondary text on dark scenes | 6.97 on ink |
| `--red-on-ink` | `#E2554A` | Red text on dark scenes | 4.98 on ink |

Story captions sit on solid paper boxes, never directly on illustration, at 15px minimum on desktop and 14px on phones. Every word passes WCAG AA, including the red highlights (5.28 on the caption paper).

### Data colours (dashboard)

The chrome stays ink, paper and red. The data gets its own scales, defined once in `:root` and selected by `src/lib/scales.ts`. Each step has a matching `--on-*` text colour. Colour is never the only signal: badges keep their number, depth chips keep their label and value, and the active scale always has a legend.

| Token | Value | Meaning | Text on it |
| --- | --- | --- | --- |
| `--mag-0` | `#8C877E` | below M2.5 | ink, 5.20 |
| `--mag-1` | `#D6A73A` | M2.5 to 4.4 | ink, 8.35 |
| `--mag-2` | `#D9622B` | M4.5 to 5.9 | ink, 5.07 |
| `--mag-3` | `#C8261C` | M6.0 to 6.9 | paper, 4.76 |
| `--mag-4` | `#8E1A12` | M7.0 and up, with an ink outline | paper, 7.73 |
| `--depth-shallow` | `#2C7385` | 0 to 70 km | paper, 4.58 |
| `--depth-intermediate` | `#2A5282` | 70 to 300 km | paper, 6.79 |
| `--depth-deep` | `#1F2D52` | 300 km and more | paper, 11.47 |
| `--desk` | `#E7E1D4` | dashboard background; panels and toolbar are paper with 1.5px ink borders | |

Where the scales are used: row badges, the map dots (with a "By magnitude / By depth" toggle stored in the URL as `color=depth`), the histogram bars and the drawer header use magnitude; every row has a depth chip.

Checks: contrast was computed for every text and fill pair, and the scales were run through deuteranopia and protanopia simulations (Machado 2009 matrices, CIEDE2000 distance between neighbouring steps), then confirmed visually with Chrome's vision-deficiency emulation. Three values were adjusted from the brief:

- the ochre went from `#C9962B` to `#D6A73A`, because under deuteranopia it was too close to the orange (distance 6.5, now 10.8);
- the teal went from `#2F7A8C` to `#2C7385`, because paper text on it was 4.16, below AA (now 4.58);
- the blue and navy went from `#2E5A88` and `#22345C` to `#2A5282` and `#1F2D52`, to keep the three depth steps evenly apart once the teal was darkened (minimum distance 11.0 under deuteranopia).

Graphite text measures only 4.13 on the desk, so the desk uses `--graphite-on-desk` (`#625E57`, 4.95) and paper panels keep the original graphite.

Type: Big Shoulders Display (titles), Archivo (interface text), JetBrains Mono (captions, labels, data), all self-hosted through Fontsource. Buttons are rectangles; the round HOLD control is the one exception. A paper grain texture sits under every page.

Motion tokens (`--ease-*`, `--dur-*`) are mirrored in `src/lib/motion.ts`. Animations touch only transform, opacity and shader uniforms; lines are "drawn" by moving masks rather than by animating stroke offsets.

### How the engraved look is made

1. **A real-time engraving pass** (`src/components/globe/EngravingEffect.ts`): every 3D scene is rendered, then converted in one post-processing shader. Brightness becomes up to four layers of angled hatching, a Sobel filter adds ink edges, lines wobble slightly and re-draw at 6 fps like hand-made frames, and paper grain sits on top. Pure red in the scene survives as the spot colour.
2. **Public-domain plates**: engravings by W. H. Holmes (1882) and Robert Mallet (1862), converted to two-colour line hatching by `scripts/prepare-assets.mjs` with the same method as the shader.
3. **Hand-built SVG**: hatch, stipple and ochre patterns, `feTurbulence` and `feDisplacementMap` for rough ink edges and the brush wipe, and a stroke-built wordmark.

No stock photography and no AI-generated images are used.

## Stack

React 19, TypeScript (strict), Vite, React Router (with the View Transitions API, and a Motion fallback where it is missing), TanStack Query, GSAP and ScrollTrigger (scrubbed chapter timelines), Lenis (smooth scroll, driven from the GSAP ticker), Motion (interface micro-interactions, drawer, shared-element morph), three.js through @react-three/fiber, drei and postprocessing, d3-geo and topojson for the 2D map, Lucide icons.

Loading: each route is its own chunk except the story, which is the landing page. The 3D stage (three.js, about 266 kB gzipped) loads only after the visitor chooses to follow the story, and renders on demand: it stops drawing whenever its chapter is covered or the tab is hidden. All materials are compiled up front so the first scene switch does not stall a frame. On phones and touch devices the device pixel ratio is capped at 1.5, the shader uses two hatch layers and the debris count drops from 40 to 16.

## Data sources

- Events: USGS GeoJSON summary feeds, `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{level}_{period}.geojson`. Fetched by the browser; refreshed every 60 seconds in the explorer.
- Globe texture: NASA Blue Marble (public domain), bundled.
- Stations: a snapshot of the 75 open stations of the Global Seismographic Network (network IU) from the EarthScope FDSN station service, bundled as `src/data/stations.json`.
- Map outlines: Natural Earth via world-atlas (public domain), bundled.

The only network request the site makes besides its own files is to the USGS feed. Full sources and licences are on `/credits`.

To rebuild the bundled assets from fresh downloads, put `bm.jpg`, `holmes.png`, `dutton.jpg`, `mallet349.jpg` and `iu.txt` in a folder and run `node scripts/prepare-assets.mjs <folder>`.

## Project layout

```
src/
  components/globe/   reusable engraved globe, engraving effect, three-free frame state
  story/              the story: gate, chapters, 3D stage, crust scene, reduced-motion version
  pages/              Explorer, Credits, Privacy, Terms, 404
  components/         header, footer, list, map, drawer, seismograph, UI controls
  lib/                api client, filters, formatting, story maths, motion tokens, scroll
  hooks/              data fetching, URL filter state, small utilities
  data/               bundled station list
  styles/             global.css (all design tokens at the top)
scripts/              asset preparation
```

## Phase 2

The globe is built to be reused by the dashboard. `Globe` takes `quakes`, an optional `focus`, a mutable `GlobeFrame` (spin, focus, wave fronts, reveal, clouds, offset) and an optional `overlay` texture. Pass a cloud texture as `overlay` and it replaces the procedural ink-blot clouds. `createGlobeFrame` and the maths helpers live in `frame.ts` and do not import three.js, so a timeline can drive the globe without pulling three into the main bundle.

## Before you deploy

Edit `src/lib/site.ts` to set your contact email. Single-page routing works on Vercel (`vercel.json`) and Netlify (`public/_redirects`) out of the box.
