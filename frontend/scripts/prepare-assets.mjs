// Converts the downloaded public-domain sources into the bundled assets.
// Usage: node scripts/prepare-assets.mjs <folder with the downloads>
// Sources and licences are listed in src/pages/Credits.tsx.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const src = process.argv[2]
if (!src) {
  console.error('Pass the folder that holds bm.jpg, holmes.png, dutton.jpg, mallet349.jpg and iu.txt')
  process.exit(1)
}
const root = path.resolve(import.meta.dirname, '..')
const PAPER = [241, 236, 226]
const INK = [20, 19, 18]

await mkdir(path.join(root, 'public/textures'), { recursive: true })
await mkdir(path.join(root, 'public/plates'), { recursive: true })
await mkdir(path.join(root, 'src/data'), { recursive: true })

// Earth: NASA Blue Marble, kept in colour. The engraving shader only reads its luminance.
for (const w of [2048, 1024]) {
  await sharp(path.join(src, 'bm.jpg'))
    .resize(w, w / 2)
    .webp({ quality: 78 })
    .toFile(path.join(root, `public/textures/earth-${w}.webp`))
}

// Plates: luminance mapped to angled line hatching, the same idea as the 3D engraving pass,
// so the scans and the renders share one inked look.
async function engrave(file, out, width, { crop, gamma = 1 } = {}) {
  let img = sharp(path.join(src, file))
  if (crop) img = img.extract(crop)
  const { data, info } = await img.resize({ width }).greyscale().normalise().raw().toBuffer({ resolveWithObject: true })
  const px = Buffer.alloc(info.width * info.height * 3)
  const layers = [
    { a: Math.PI / 4, s: 5, t: 0.7 },
    { a: -Math.PI / 4, s: 6, t: 0.5 },
    { a: 0, s: 4, t: 0.32 },
    { a: Math.PI / 2, s: 5, t: 0.14 },
  ]
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = y * info.width + x
      const lum = Math.pow(data[i] / 255, gamma)
      const dark = 1 - lum
      let ink = 0
      for (const l of layers) {
        if (dark < 1 - l.t) continue
        const wob = Math.sin(x * 0.05 + y * 0.031) * 0.6
        const d = (x * Math.sin(l.a) + y * Math.cos(l.a) + wob) / l.s
        const f = Math.abs(d - Math.round(d))
        const w = Math.min(0.5, (dark - (1 - l.t)) * 1.2 + 0.06)
        if (f < w * 0.5) ink = 1
      }
      if (lum < 0.08) ink = 1
      const c = ink ? INK : PAPER
      px[i * 3] = c[0]
      px[i * 3 + 1] = c[1]
      px[i * 3 + 2] = c[2]
    }
  }
  await sharp(px, { raw: { width: info.width, height: info.height, channels: 3 } })
    .png({ palette: true, colours: 2, compressionLevel: 9 })
    .toFile(path.join(root, `public/plates/${out}.png`))
}

await engrave('holmes.png', 'holmes-toroweap', 1100, { crop: { left: 1700, top: 700, width: 2600, height: 1840 }, gamma: 0.75 })
await engrave('dutton.jpg', 'dutton-point-sublime', 1100, { crop: { left: 30, top: 100, width: 1910, height: 1000 }, gamma: 0.8 })
await engrave('mallet349.jpg', 'mallet-wavefronts', 700, { gamma: 0.9 })

// Stations: Global Seismographic Network (IU), from the FDSN station service. Only stations without an end date.
const txt = await readFile(path.join(src, 'iu.txt'), 'utf8')
const seen = new Map()
for (const line of txt.split('\n').slice(1)) {
  const [net, sta, lat, lon, , site, , end] = line.split('|')
  if (!sta || (end && end.trim())) continue
  seen.set(sta, { code: `${net}.${sta}`, lat: Number(lat), lon: Number(lon), site: site.trim() })
}
const stations = [...seen.values()].sort((a, b) => a.code.localeCompare(b.code))
await writeFile(path.join(root, 'src/data/stations.json'), JSON.stringify(stations, null, 0) + '\n')
console.log(`Wrote textures, 3 plates and ${stations.length} stations`)
