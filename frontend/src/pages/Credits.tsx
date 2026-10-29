import LegalLayout, { type LegalSection } from '../components/LegalLayout'
import { SITE } from '../lib/site'

interface Credit {
  what: string
  source: string
  href: string
  licence: string
  use: string
}

const images: Credit[] = [
  {
    what: 'Blue Marble: Land Surface, Shallow Water, and Shaded Topography. Reto Stöckli, NASA Goddard Space Flight Center.',
    source: 'NASA Visible Earth',
    href: 'https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography',
    licence: 'Public domain (NASA imagery, credit requested)',
    use: 'Texture of the engraved globe. Resized to 2048 and 1024 pixels and bundled with the site.',
  },
  {
    what: 'Grand Canyon at the foot of the Toroweap, looking east. William Henry Holmes, in C. E. Dutton, Tertiary History of the Grand Cañon District, Atlas (USGS, 1882).',
    source: 'Wikimedia Commons',
    href: 'https://commons.wikimedia.org/wiki/File:Grand_Canyon_at_the_foot_of_the_Toroweap_-_looking_east,_William_Henry_Holmes.png',
    licence: 'Public domain',
    use: 'Chapter 3, first panel. Cropped and redrawn as line hatching in the site palette.',
  },
  {
    what: 'Panorama from Point Sublime. William Henry Holmes, in the same atlas (USGS, 1882).',
    source: 'Wikimedia Commons',
    href: 'https://commons.wikimedia.org/wiki/File:Duttonnp000086AAA2.jpg',
    licence: 'Public domain',
    use: 'Chapter 2 title card. Cropped and redrawn as line hatching.',
  },
  {
    what: 'Figure 349, wave fronts from a focus. Robert Mallet, Great Neapolitan Earthquake of 1857, volume 2 (1862).',
    source: 'Wikimedia Commons',
    href: 'https://commons.wikimedia.org/wiki/File:Great_Neapolitan_Earthquake_of_1857_Vol_2_Fig349.jpg',
    licence: 'Public domain',
    use: 'Chapter 5 inset. Redrawn as line hatching.',
  },
]

const data: Credit[] = [
  {
    what: 'Earthquake events: GeoJSON summary feeds.',
    source: 'U.S. Geological Survey, Earthquake Hazards Program',
    href: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php',
    licence: 'Public domain',
    use: 'Every event, count and magnitude on the site. Fetched live by your browser.',
  },
  {
    what: 'Station codes and coordinates of the Global Seismographic Network (network IU). Albuquerque Seismological Laboratory/USGS, doi:10.7914/SN/IU.',
    source: 'EarthScope FDSN station web service',
    href: 'https://service.earthscope.org/fdsnws/station/1/',
    licence: 'Open station metadata',
    use: 'Chapter 6. A snapshot of 75 open stations is bundled; no request is made at runtime.',
  },
  {
    what: 'P wave travel times read from the IASP91 reference Earth model (Kennett and Engdahl, 1991).',
    source: 'Published travel-time tables',
    href: 'https://doi.org/10.1111/j.1365-246X.1991.tb06724.x',
    licence: 'Values cited, not copied as a work',
    use: 'Approximate arrival times in chapters 5 and 6, interpolated between tabulated points.',
  },
  {
    what: 'Coastlines for the 2D map: Natural Earth 1:110m, packaged by world-atlas.',
    source: 'Natural Earth',
    href: 'https://github.com/topojson/world-atlas',
    licence: 'Public domain',
    use: 'Map view and event drawer in the explorer.',
  },
]

const type: Credit[] = [
  {
    what: 'Big Shoulders Display, Archivo and JetBrains Mono.',
    source: 'Fontsource packages, served from this site',
    href: 'https://fontsource.org',
    licence: 'SIL Open Font License 1.1',
    use: 'All text. No font service is contacted.',
  },
  {
    what: 'Lucide icons.',
    source: 'lucide.dev',
    href: 'https://lucide.dev',
    licence: 'ISC',
    use: 'Interface icons.',
  },
]

function List({ items }: { items: Credit[] }) {
  return (
    <ul className="credit-list">
      {items.map((c) => (
        <li key={c.href}>
          <p className="credit-what">{c.what}</p>
          <dl className="credit-meta">
            <div>
              <dt>Source</dt>
              <dd>
                <a href={c.href} target="_blank" rel="noreferrer">
                  {c.source}
                </a>
              </dd>
            </div>
            <div>
              <dt>Licence</dt>
              <dd>{c.licence}</dd>
            </div>
            <div>
              <dt>Used for</dt>
              <dd>{c.use}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  )
}

const sections: LegalSection[] = [
  { id: 'images', title: 'Images and textures', body: <List items={images} /> },
  { id: 'data', title: 'Data and science', body: <List items={data} /> },
  { id: 'type', title: 'Type and icons', body: <List items={type} /> },
  {
    id: 'method',
    title: 'How the plates were made',
    body: (
      <p>
        The historical plates were converted by a script in this repository (<code>scripts/prepare-assets.mjs</code>) that
        maps brightness to angled line hatching in two colours, the same method the 3D scenes use in real time. No image on
        {' '}
        {SITE.name} was generated by AI, and no stock photography is used.
      </p>
    ),
  },
]

export default function Credits() {
  return (
    <LegalLayout
      title="Credits"
      intro={<p>Every image, texture and dataset on {SITE.name}, where it came from and under what terms it is used.</p>}
      sections={sections}
    />
  )
}
