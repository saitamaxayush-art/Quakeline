import { Link } from 'react-router-dom'
import LegalLayout, { type LegalSection } from '../components/LegalLayout'
import { SITE } from '../lib/site'

const sections: LegalSection[] = [
  {
    id: 'acceptance',
    title: 'Using this site',
    body: (
      <p>
        By using {SITE.name} you agree to these terms. If you do not agree, please do not use the site. {SITE.name} is free
        and requires no account.
      </p>
    ),
  },
  {
    id: 'not-warning',
    title: 'Not an alert or warning service',
    body: (
      <>
        <p className="callout">
          Do not rely on {SITE.name} for safety decisions. It is not an earthquake early warning system and it does not issue
          tsunami warnings.
        </p>
        <p>
          The story on the home page explains one real event. Its arrival times and seismogram drawing are
          approximations for illustration, labelled as such, and are not measurements.
        </p>
        <p>
          The feed it reads can be minutes behind real events, and the site may be unavailable at any time. In an emergency,
          follow your local authorities. In India that includes the National Disaster Management Authority and the Indian
          National Centre for Ocean Information Services for tsunami bulletins.
        </p>
      </>
    ),
  },
  {
    id: 'data',
    title: 'Where the data comes from',
    body: (
      <>
        <p>
          Event information comes from the public GeoJSON summary feeds of the U.S. Geological Survey Earthquake Hazards
          Program. USGS data is in the public domain. {SITE.name} is independent and is not affiliated with, sponsored by or
          endorsed by the USGS or the U.S. government.
        </p>
        <p>
          The optional cloud layer shows satellite imagery from NASA GIBS and OpenWeatherMap for geographic context. It is not
          a weather forecast, and weather has no known connection to earthquakes. {SITE.name} is not affiliated with NASA,
          NOAA, the Japan Meteorological Agency or OpenWeather.
        </p>
        <p>
          Automatic event solutions are preliminary. Magnitudes, locations and depths are often revised, and some events are
          later deleted. {SITE.name} shows what the feed reports at the time it is fetched and does not correct or verify it.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>interfere with the site or try to gain access to systems you are not allowed to reach;</li>
          <li>use automated tools to send large numbers of requests through the site;</li>
          <li>present {SITE.name} or its output as an official government source.</li>
        </ul>
        <p>If you need the data in bulk, use the USGS feeds and APIs directly.</p>
      </>
    ),
  },
  {
    id: 'ip',
    title: 'Content and code',
    body: (
      <p>
        The design, text and code of {SITE.name} belong to its authors. Map outlines (Natural Earth), the globe texture (NASA
        Blue Marble) and the 19th century engravings are in the public domain; see the <Link to="/credits">credits</Link>{' '}
        for each source. Open source libraries and fonts used to build the site remain under their own licences.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'No warranty and limits of liability',
    body: (
      <>
        <p>
          The site is provided "as is" and "as available", without warranties of any kind, including accuracy, completeness,
          availability or fitness for a particular purpose.
        </p>
        <p>
          To the extent the law allows, the authors of {SITE.name} are not liable for any loss or damage arising from your use
          of the site or from reliance on any information shown on it.
        </p>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: <p>These terms are governed by the laws of India. Courts in Pune, Maharashtra have jurisdiction over any dispute.</p>,
  },
  {
    id: 'changes',
    title: 'Changes and contact',
    body: (
      <p>
        We may update these terms. The date at the top shows the latest version, and continued use after a change means you
        accept it. Questions can be sent to <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. Read how we
        handle data in the <Link to="/privacy">privacy policy</Link>.
      </p>
    ),
  },
]

export default function Terms() {
  return (
    <LegalLayout
      title="Terms and conditions"
      intro={<p>The rules for using {SITE.name}, and what it can and cannot be relied on for.</p>}
      sections={sections}
    />
  )
}
