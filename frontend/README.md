# Quakeline

One earthquake, from the rock to your screen. Quakeline opens with a scroll story about the strongest earthquake of the past 24 hours, then hands you a live explorer for every event the U.S. Geological Survey reports: a 3D globe with a satellite cloud timeline, the event list beside it, and a local map for any event you open.

**Story concept.** A seismograph drum records the day as ink on paper. The site follows one real event the way the record does: from orbit down to the hypocentre, through the stress that loads a fault, the rupture you trigger yourself (press and hold), the waves crossing the planet, the stations that hear them, and finally the published catalogue line. Then it opens the full catalogue.

Every number on the site comes from the live USGS feed or is computed from it, and computed values are labelled "approx." on the page.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and production build into dist/
npm run preview    # serve the production build
```

Needs Node 18 or newer (Node 23 or newer to run `scripts/test-proxy.ts` directly). The earthquake data needs no key. The cloud layer's current frame needs an OpenWeatherMap key; without one, the rest of the site works and the layer says so (see "Cloud layer API key" below).

```bash
node scripts/test-proxy.ts                                       # tests the cloud proxy, with and without a key
node scripts/verify-globe.mjs http://localhost:5173 shots \
  --nokey http://localhost:5174                                  # explorer checks at 390 and 1440 px; second server started with OWM_API_KEY= (empty)
```

## Routes

| Route | What it is |
| --- | --- |
| `/` | The story. Old shared links such as `/?q=alaska&min=4` redirect to `/explore` with the same filters. |
| `/explore` | The dashboard: the globe with the satellite cloud layer (`clouds=1`), search, filters, sort, the event list, and the event panel with a local map. Every filter lives in the URL. Old links with `view=list`, `view=map`, `view=globe` or `color=` still open; those parameters are ignored. |
| `/api/clouds/{z}/{x}/{y}` | Serverless proxy for OpenWeatherMap cloud tiles (see below). Not a page. |
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

Where the scales are used: row badges, the globe pulses, the local map's markers, the histogram bars and the drawer header use magnitude; every row has a depth chip.

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

## The explorer: globe first

The flat world map and the List / Map / Globe switcher are gone. `/explore` shows the toolbar, the result count and filter chips, then the globe card (globe, cloud panel, magnitude key), then the filters beside the event list. `src/components/GlobeView.tsx` loads when the card comes within 600 px of the viewport, or as soon as an event is opened, so three.js is not part of the first load.

**Built around the clouds.** The dashboard globe no longer uses the engraving shader; that look stays in the story. Its own shader draws:

| Layer | Look | Why |
| --- | --- | --- |
| Surface | Ocean `#6F7D7E`, land `#A29A87` (one step lighter and warmer), from a land mask drawn at runtime from the bundled Natural Earth 1:110m land; a thin coastline, a paper graticule every 30 degrees, a thin dark edge at the limb | Low contrast, no hatching, no dark shading under the clouds |
| Light | From the camera side: brightness falls off by 16 % toward the limb | No night side |
| Atmosphere | A thin pale rim around the limb | Separates the disc from the ink plate |
| Cloud shadow | The cover, blurred and nudged, in ink at 45 % | A faint dark edge, so clouds read over land as well as ocean |
| Clouds | Near-white `#FBF9F4`, alpha through a contrast curve (`pow(smoothstep(0.07, 0.72, cover), 0.6)`), greyer at thin edges | Clearly visible at the default zoom |
| Pulses | `--mag-*` fills with an ink ring, drawn after the clouds | Readable on white cloud |

Every layer above the surface is transparent so `renderOrder` sets the stack (surface, atmosphere, cloud shadow, clouds, pulses), and each tests depth against the surface, which hides the far side.

**Controls on the globe:** drag with inertia, wheel or pinch zoom, zoom buttons, "Reset view", keyboard (arrows, plus, minus, 0). With clouds off, a "Show clouds" button sits on the plate; with clouds on, the label reads "Clouds, 31 Oct 2026 03:00 UTC" with the source under it. All text on the plate sits on solid ink (paper on ink 15.76:1, graphite-on-ink 6.97:1), so its contrast never depends on the clouds behind it.

**Cloud panel:** "Show clouds", play and pause, the scrubber with time labels, "Cloud opacity" (20 to 100 %, default 90 %) and "Dim clouds" (cloud opacity times 0.38, so quakes stay readable where cover is dense).

**Hover, click and picking** work as before: the nearest event in front of the horizon within 9 px (18 px for touch); a click opens the event panel and the camera eases to the event. The canvas draws only while within 200 px of the viewport and the tab is visible.

## Event map ("Where it happened")

`src/components/EventMap.tsx`, in the event panel. It opens for a click on the globe or in the list.

- **What it shows:** a flat d3-geo map centred on the epicentre, drawn with an azimuthal equidistant projection so distances from the epicentre read true. Layers:
  - sea as a muted grey background, with land filled in paper
  - coastlines and dashed country borders
  - up to six country names, from the outline data
  - a graticule whose latitude and longitude labels sit in paper bands on the left and bottom of the frame
  - faint dashed rings at 50, 100 and 250 km, drawn on top of the map
  - a scale bar
- **Markers:** the selected event is a large marker in its magnitude colour with an ink outline and a label such as "M4.5, 10 km deep". The label moves left or below when it would hit the edge or the zoom buttons. Every other event from the feed within the radius is a smaller dot in its magnitude colour, with a tooltip on hover and focus; clicking one switches the panel to that event. Only markers inside the visible map are drawn.
- **Radius:** presets of 50, 100, 250 and 500 km. The default is 250 km. Over open ocean it widens through 500, 750 and 1,000 km until the nearest land is in view, with a caption ("Zoomed out to 1,000 km to show nearby land."). When even 1,000 km is not enough, the caption gives the nearest land and its distance instead.
- **Text summary** under the map, for example "Epicentre at 49.916 N, 156.024 E, 85 km deep (intermediate). Nearest land: Russia, about 36 km away." The country containing the epicentre (`geoContains`) or the nearest coastline point comes from the same outline data.
- **Controls:** drag to pan, wheel and pinch zoom (1 to 8x), zoom and reset buttons, keyboard (arrows, plus, minus, 0), "Back to globe". Changing events flies from the previous epicentre to the new one; changing the radius scales in or out. Only transform and opacity animate, and reduced motion turns the flight off.
- **Data, all already in the project:** Natural Earth country outlines from the world-atlas package, served as plain JSON files from the build:
  - **1:50m** (243 kB gzipped) is fetched the first time a panel opens.
  - **1:10m** (986 kB gzipped) is fetched only for close views: a radius of 100 km or less, or zoomed in 2.5x.

  Only the outlines near the event are projected. Three inverted polygon parts in the 1:10m file (the Maldives) are re-wound when the file loads, so they cannot flood the map. No tile service, key or other third party is involved; the only external host the explorer contacts is `earthquake.usgs.gov` (plus NASA GIBS and the site's own proxy when the cloud layer is on).
- **Contrast:** all text sits on paper, either in the frame bands or on a paper halo: ink 15.8:1, graphite 4.6:1 or better.

## Satellite cloud imagery

A cloud layer on the globe, off by default (the privacy page says so). Turning it on, with the panel checkbox or the "Show clouds" button on the globe, is the only thing that contacts NASA GIBS or OpenWeatherMap.

**Frames.** Eight hourly past frames plus "Now".

| Frame | Source | How |
| --- | --- | --- |
| Past hours | NASA GIBS WMTS (`epsg3857/best`, `GoogleMapsCompatible_Level6`), Clean Infrared band 13 (10.3 µm) from GOES-East, GOES-West and Himawari | The browser asks GIBS `DescribeDomains` which times exist for each satellite over the past 20 hours, then picks whole hours that at least two satellites have (within 10 minutes). Tiles are requested with that `TIME`. No key. |
| Now | OpenWeatherMap `clouds_new` | Through this site's `/api/clouds` proxy. OpenWeatherMap does not publish an observation time for this layer, so the frame is labelled with the time the proxy fetched it. |

Both APIs were tested before building on them: GIBS layers, tile grid, time list and CORS headers (`Access-Control-Allow-Origin: *`), 404 for times that do not exist; OpenWeatherMap tiles at zoom 0 to 3 with the key, 401 with a wrong key.

**Turning pixels into cloud.** GIBS draws infrared brightness temperature with a fixed palette, bundled as `src/lib/clouds/irColormap.ts` (generated from the published colour map). The worker inverts it to temperature and maps +20 °C (clear) to -20 °C (full cover); that ramp was calibrated against OpenWeatherMap's cover for the same tile and time. Each pixel comes from the satellite that sees it most directly, and cover fades out between 58 and 72 degrees from the sub-satellite point, because oblique views read colder than they are. OpenWeatherMap tiles carry cover in alpha (127 = full).

**Coverage gap, stated on the page.** GIBS publishes no Meteosat imagery, so past frames have no data over Europe, Africa and the Indian Ocean. The panel says so in words whenever such a frame is shown.

**Rendering.** `src/lib/clouds/cloud.worker.ts` fetches tiles, decodes them, and reprojects each frame to equirectangular (1024 x 512, one byte per pixel), off the main thread. The globe uploads each frame as a texture when it arrives and blends two of them in the cloud shader.

**Timeline.** Play and pause, a scrubber with frame ticks and time labels, and the time and source of the current frame ("08:30, 2 h ago, NASA GIBS, infrared (10.3 µm) from GOES-East, GOES-West, Himawari"). Frames hold, then crossfade over 0.5 s; dragging the scrubber blends the two neighbouring frames continuously. Frames load newest first; every frame is uploaded to the GPU as soon as it arrives, and playback never moves to a frame that has not loaded (it waits, and says so). After "Now" it wraps to the oldest loaded frame. Arrow keys step whole frames. With reduced motion, frames switch without fading.

**States,** all styled like the rest of the dashboard: finding frames, loading with progress, waiting for a frame, offline (with automatic retry when the connection returns), GIBS unavailable (current frame only, with retry), key missing ("Cloud layer needs an API key, see README.", the past frames still play), key rejected, rate limited, proxy refused, browser without Web Workers or OffscreenCanvas.

The panel carries this line: "Shown for geographic context only. Clouds and weather do not cause or predict earthquakes."

## Cloud layer API key

The OpenWeatherMap key is used only on the server. It has no `VITE_` prefix, so Vite never puts it in the browser bundle.

**Locally**

1. `cp .env.example .env.local` (in `frontend/`).
2. Set `OWM_API_KEY=` to your key. `.env.local` is listed in `.gitignore`.
3. `npm run dev` (or `npm run preview`). A small Vite plugin in `vite.config.ts` serves `/api/clouds/...` with the same handler as the Vercel function, reading the key from `.env.local`. `vercel dev` run from `frontend/` works too.

New OpenWeatherMap keys can take up to about two hours to start working; until then the panel reports that the key was rejected.

**On Vercel**

1. Import the repository and set **Root Directory** to `frontend`. Vercel detects Vite, builds `dist/`, and deploys `api/clouds/[z]/[x]/[y].ts` as a function.
2. Project Settings, Environment Variables: add `OWM_API_KEY` for Production and Preview. Optionally add `ALLOWED_ORIGINS` (comma-separated) if you serve the site from a custom domain; the deployment's own Vercel domains are allowed automatically.
3. Redeploy. `vercel.json` rewrites every path except `/api/` to the app.

### How the key is protected

- **It never reaches the browser.** The browser only ever calls `/api/clouds/{z}/{x}/{y}`. The function (`api/_lib/cloudTile.ts`) adds the key server-side, and the key is never written to a response, a header or a log. Error objects, which can contain the upstream URL, are never logged or returned. The test suite searches every response for the key.
- **Checked in the build:** `dist/` contains neither the key value nor the string `OWM_API_KEY`, nor the OpenWeatherMap host or `appid` (0 files each).
- **Strict input:** `z` must be an integer from 0 to 3, and `x` and `y` integers from 0 to 2^z - 1. Anything else gets 400. Only GET and HEAD are accepted.
- **Only this site's pages:** a request must come from an allowed origin. Cross-origin requests are checked by `Origin`, same-origin ones by `Referer` or `Sec-Fetch-Site`, and a request with none of them (for example plain `curl`) gets 403. Localhost is refused on production deployments. A page on another site cannot fake these headers in its visitors' browsers.
- **Little to steal anyway:** a script outside a browser can forge headers, so the proxy is also built to be useless as a free key. It serves one layer only, at four zoom levels: 85 possible images in all. Responses carry `Cache-Control: public, max-age=600` and a matching `Vercel-CDN-Cache-Control`, so repeat requests are answered by Vercel's CDN without reaching OpenWeatherMap.
- **Clear failures:** missing key gives 503 `missing_key`, a rejected key 502 `invalid_key`, rate limiting 429, timeouts 504; the page turns each into a plain message.

## Stack

React 19, TypeScript (strict), Vite, React Router (with the View Transitions API, and a Motion fallback where it is missing), TanStack Query, GSAP and ScrollTrigger (scrubbed chapter timelines), Lenis (smooth scroll, driven from the GSAP ticker), Motion (interface micro-interactions, drawer, shared-element morph), three.js through @react-three/fiber, drei and postprocessing, d3-geo and topojson for the 2D map, Lucide icons.

Loading: each route is its own chunk except the story, which is the landing page. The 3D stage (three.js, about 266 kB gzipped) loads only after the visitor chooses to follow the story, and renders on demand: it stops drawing whenever its chapter is covered or the tab is hidden. All materials are compiled up front so the first scene switch does not stall a frame. On phones and touch devices the device pixel ratio is capped at 1.5, the shader uses two hatch layers and the debris count drops from 40 to 16.

## Data sources

- Events: USGS GeoJSON summary feeds, `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{level}_{period}.geojson`. Fetched by the browser; refreshed every 60 seconds in the explorer.
- Globe texture: NASA Blue Marble (public domain), bundled.
- Stations: a snapshot of the 75 open stations of the Global Seismographic Network (network IU) from the EarthScope FDSN station service, bundled as `src/data/stations.json`.
- Map outlines: Natural Earth via world-atlas (public domain), bundled.
- Satellite cloud imagery, past hours (only with the cloud layer on): NASA GIBS WMTS, GOES-East, GOES-West and Himawari band 13 infrared. Fetched by the browser from `gibs.earthdata.nasa.gov`.
- Satellite cloud imagery, current hour (only with the cloud layer on): OpenWeatherMap `clouds_new`, fetched by this site's server through `/api/clouds`, so OpenWeatherMap never sees the visitor.

With the cloud layer off, the only network request the site makes besides its own files is to the USGS feed. Full sources and licences are on `/credits`; the services contacted are listed on `/privacy`.

To rebuild the bundled assets from fresh downloads, put `bm.jpg`, `holmes.png`, `dutton.jpg`, `mallet349.jpg` and `iu.txt` in a folder and run `node scripts/prepare-assets.mjs <folder>`.

## Project layout

```
src/
  components/globe/   reusable engraved globe, engraving effect, three-free frame state
  components/GlobeView.tsx   the dashboard's globe (surface, clouds, pulses, controls)
  components/CloudLayer.tsx  cloud panel (show, play, scrubber, opacity, dim, states)
  components/EventMap.tsx    the event panel's map ("Where it happened")
  lib/clouds/         cloud timeline: sources, worker, playback store, infrared colour map
  story/              the story: gate, chapters, 3D stage, crust scene, reduced-motion version
  pages/              Explorer, Credits, Privacy, Terms, 404
  components/         header, footer, list, drawer, seismograph, UI controls
  lib/                api client, filters, formatting, story maths, motion tokens, scroll
  hooks/              data fetching, URL filter state, small utilities
  data/               bundled station list
  styles/             global.css (all design tokens at the top)
scripts/              asset preparation, proxy tests, Playwright checks
api/
  clouds/[z]/[x]/[y].ts   Vercel function: OpenWeatherMap tile proxy
  _lib/cloudTile.ts       the proxy itself, shared with the Vite dev and preview servers
```

## Reusing the globe

`Globe` takes `quakes`, an optional `focus`, a mutable `GlobeFrame` (spin, focus, wave fronts, reveal, clouds, offset), and an optional `overlay` texture. It is the story's globe; its clouds are decorative ink blots, not data. The dashboard draws its own globe (`GlobeView.tsx`) around the real satellite frames. `createGlobeFrame` and the maths helpers live in `frame.ts` and do not import three.js.

## Verification

Latest run, after the explorer became globe-first:

| Check | Result |
| --- | --- |
| `npm run build` (TypeScript strict, both tsconfigs, no `any`) | passes |
| Proxy tests, `node scripts/test-proxy.ts` (proxy unchanged) | 23 of 23 pass |
| `node scripts/verify-globe.mjs` at 390 and 1440 px | no horizontal scroll, no unexpected console errors |
| Clouds at the default zoom; playback | visible over ocean and land at both widths; between two moments of playback the label moves 3 hours and 9 to 14 % of the plate's pixels change |
| Dim clouds, clouds off then on, old `?view=map` / `?view=globe&color=depth` / `?view=list` links | work; old links open the globe |
| Cloud states: loading, offline, error (GIBS and the proxy blocked), key missing | each shows its message; with the key missing the globe still turns and events still open |
| Event map after clicking an event; zoom; Back to globe | works at both widths (details: `node scripts/verify-eventmap.mjs`) |
| Lighthouse `/explore`, mobile preset | Performance 83, Accessibility 100, CLS 0.008 |
| Lighthouse `/explore`, desktop preset | Performance 100, Accessibility 100 |
| Frame rate, Chrome with GPU, 1440 x 900 at DPR 2, clouds playing while dragging the globe | 144 fps (display rate), p95 7.8 ms, no frame over 25 ms, also with 4x CPU throttling (Apple M4; faster than a mid-range laptop) |

Earlier checks that this change did not touch: the story walk, the bundle search for the key (0 files), Lighthouse on `/` (mobile 94, desktop 100).

## Requirements and where they are met

| Requirement | Where |
| --- | --- |
| Globe as the main view (the view switcher and flat map were later removed) | `src/pages/Explorer.tsx`, `src/lib/filters.ts` |
| Globe for the dashboard | `src/components/GlobeView.tsx` (its own clean surface shader since the clouds revision; the Phase 1 `Globe` remains the story's) |
| Pulses sized by magnitude, magnitude colour tokens, red only for strong events | `Pulses` in `GlobeView.tsx` (`dotSize`, `tokenColor('--mag-n')`) |
| Hover tooltip; click opens the drawer; camera eases to the event | `pick`, `screenOf`, `onSelect`, `Rig` flight in `GlobeView.tsx` |
| Drag with inertia, wheel and pinch zoom, Reset view | pointer and wheel handlers, `Rig`, `.globe-tools` in `GlobeView.tsx` |
| Lazy-loaded; pauses when hidden | `lazy(() => import('../components/GlobeView'))` in `Explorer.tsx`; IntersectionObserver and `visibilitychange` set `frameloop` |
| Cloud layer with toggle | `CloudShell` in `GlobeView.tsx`, `CloudPanel` in `src/components/CloudLayer.tsx`, `clouds=1` in the URL |
| Play and pause, draggable scrubber with time labels | `CloudPanel` |
| Crossfade, preloading, no stutter | `src/lib/clouds/timeline.ts` (hold, fade, wait-for-ready, wrap), `gl.initTexture` in `CloudFrames` |
| Clouds clearly visible, base low contrast | surface, atmosphere, cloud shadow and cloud layers in `GlobeView.tsx` |
| Serverless proxy, key from server env, `Cache-Control: public, max-age=600` | `api/clouds/[z]/[x]/[y].ts`, `api/_lib/cloudTile.ts` |
| z, x, y validated; site origin only | `parseTile`, `originAllowed` in `cloudTile.ts`; tested in `scripts/test-proxy.ts` |
| `.env.example`, README setup (local and Vercel) | `.env.example`, "Cloud layer API key" above |
| Works locally | Vite plugin in `vite.config.ts` (dev and preview); `vercel dev` |
| Past frames from NASA GIBS with TIME; OWM as "now"; each frame labelled with source and time | `src/lib/clouds/cloud.worker.ts` (`planGibs`, `gibsFrame`, `owmFrame`), `describe` in `CloudLayer.tsx` |
| Missing or invalid key message; rest of the app keeps working | `KEY_MESSAGES` in `CloudLayer.tsx`; past frames still play |
| Honest label, context only | "Satellite cloud imagery" toggle, source line, note under the panel, coverage gap stated |
| Loading, error and offline states | `CloudPanel` states, `online` and `offline` handling in `timeline.ts` |
| Privacy page names OpenWeatherMap and NASA GIBS; credits list them | `src/pages/Privacy.tsx`, `src/pages/Credits.tsx` (also Terms) |
| Polish pass | chapter title cards no longer appear as empty boxes while the next chapter slides in, and Ch. 1's card is drawn when the gate closes (`src/story/chapters/shared.tsx`, `Story.tsx`) |
| Key never reaches the browser | bundle search above |
| `.env.local` not tracked | `frontend/.gitignore`; `git status` shows it neither untracked nor staged |

## Before you deploy

Edit `src/lib/site.ts` to set your contact email. Single-page routing works on Vercel (`vercel.json`) and Netlify (`public/_redirects`) out of the box.

### Explorer revision: globe first, local map

| Requirement | Where |
| --- | --- |
| Clean, lighter, low-contrast base; thin edge and graticule | `surfaceFrag` and `SURFACE` in `GlobeView.tsx`, land mask from world-atlas 1:110m |
| Clouds on top of surface and atmosphere, near-white, strong alpha, contrast curve, dark edge | `Atmosphere`, `CloudShell` (shadow and cloud) in `GlobeView.tsx` |
| Even light from the camera, thin rim, no night side | `surfaceFrag`, `atmoFrag` |
| Crossfade, label on the globe, play and scrubber | `timeline.ts`, `.globe-label` with `globeLabel()` in `CloudLayer.tsx`, `CloudPanel` |
| Cloud opacity slider, Show clouds toggle, Dim clouds | `CloudPanel`; `.globe-show` button on the plate; `DIM` in `GlobeView.tsx` |
| Pulses on top of clouds with an ink outline | `Planet` in `GlobeView.tsx` (render order 4 to 7, `EDGE`) |
| AA contrast for text and controls on the globe | solid ink behind `.globe-label`, `.globe-hint`; paper buttons with ink text |
| Map view and switcher removed; old `view=` links open the globe | `src/pages/Explorer.tsx`, `parseFilters` in `src/lib/filters.ts` |
| Map on click, centred, zoomable, with nearby events and "Back to globe" | `src/components/EventMap.tsx`, `onBack` in `QuakeDrawer.tsx` and `Explorer.tsx` |
| Map data with no key and no new service | world-atlas `countries-50m.json` and, for close views, `countries-10m.json`, already in the project |
| Old world-map code removed | `WorldMap.tsx`, `mapProjection.ts`, `CloudMapLayer`, the worker's map frames and the `.map-*` styles deleted |

### Event map revision: real geography in the event panel

| Requirement | Where |
| --- | --- |
| Flat geographic map centred on the epicentre, about 250 km by default | `EventMap.tsx` (azimuthal equidistant projection, `DEFAULT_KM`) |
| Land 1:50m, 1:10m for close views, lazy-loaded with the panel | `loadOutlines()`, `?url` JSON assets, `wantFine` |
| Sea, land, borders, labelled graticule, country names from existing data | `paths`, `ticks`, `.emap-*` styles |
| Large selected marker with label; nearby dots with tooltip and click | `.emap-epi`, `.emap-near`, `labelPos` |
| Scale bar, zoom buttons, wheel, pinch, drag, presets 50/100/250/500, Back to globe | `EventMap.tsx` |
| Rings on top of the map | `.emap-ring` inside the map group, labels hidden on rings too small to label |
| Open ocean widens to show land, with a caption | `nearestLand()`, `AUTO_STEPS`, `.emap-note` |
| Fly-in on event change, transform and opacity only | `flyRef` animation in `EventMap.tsx` |
| Accessible name, text summary, keyboard | `aria-label` on the map, `.emap-summary`, `onKey`, focusable markers |
| No new keys or third-party requests | network check in `scripts/verify-eventmap.mjs` |
| Old ring-only component removed | `LocalMap.tsx` and the `.local-*` styles deleted |
