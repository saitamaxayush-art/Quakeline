import { Link } from 'react-router-dom'
import LegalLayout, { type LegalSection } from '../components/LegalLayout'
import { SITE } from '../lib/site'

const sections: LegalSection[] = [
  {
    id: 'summary',
    title: 'The short version',
    body: (
      <>
        <p>
          {SITE.name} has no accounts, no sign up, no advertising and no analytics. We do not set cookies. The only thing kept
          in your browser is one setting that remembers how you left the opening screen (see below). There is no database
          behind this site that could hold information about you.
        </p>
        <p>
          The only personal data involved is the technical information any website receives when your browser loads it, such
          as your IP address. The sections below explain where that goes.
        </p>
      </>
    ),
  },
  {
    id: 'collect',
    title: 'What is collected',
    body: (
      <>
        <p>When you use {SITE.name}, two kinds of servers receive requests from your browser:</p>
        <ul>
          <li>
            <strong>The server hosting this site.</strong> It sends you the page files. Like most web hosts, it may keep
            standard access logs: IP address, browser type, the page requested and the time. These logs belong to the hosting
            provider and are used for security and to keep the site running.
          </li>
          <li>
            <strong>The USGS earthquake feed.</strong> Event data is fetched by your browser directly from
            earthquake.usgs.gov. The U.S. Geological Survey therefore also receives your IP address and browser details. Its
            handling of that information is covered by the{' '}
            <a href="https://www.usgs.gov/policies-and-notices" target="_blank" rel="noreferrer">
              USGS policies and notices
            </a>
            .
          </li>
        </ul>
        <p>
          Fonts, map outlines, the globe texture (NASA Blue Marble), the historical engravings and the seismic station list are
          all bundled with the site, so no font, map, image or texture service is contacted. The story page adds no new
          external requests: it reads the same USGS feed as the explorer. Sources are listed on the{' '}
          <Link to="/credits">credits page</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'url',
    title: 'Search terms and filters',
    body: (
      <p>
        What you type in the search box and the filters you choose are kept in the page address (for example{' '}
        <code>?q=alaska&amp;min=4</code>) so that you can bookmark or share a view. They are processed in your browser and are
        not sent to us. The address may appear in your browser history and in hosting access logs, and if you share the link,
        anyone who opens it will see the same filters.
      </p>
    ),
  },
  {
    id: 'storage',
    title: 'One setting in local storage',
    body: (
      <>
        <p>
          The opening screen asks whether to follow the story or skip to the data. Your answer is saved in your browser's local
          storage under the key <code>quakeline.gate</code>, with the value <code>follow</code> or <code>skip</code>, so the
          question is not asked again. It never leaves your device and contains nothing about you.
        </p>
        <p>
          To clear it, choose "Story" in the site menu, or clear this site's data in your browser. If your browser blocks
          storage, the site still works and simply asks again.
        </p>
      </>
    ),
  },
  {
    id: 'clipboard',
    title: 'Clipboard',
    body: (
      <p>
        The "Copy link" and "Coordinates" buttons write text to your clipboard only when you press them. {SITE.name} never
        reads from your clipboard.
      </p>
    ),
  },
  {
    id: 'links',
    title: 'Links to other sites',
    body: (
      <p>
        Event pages link to the full USGS record and other external pages. Once you follow a link, the privacy policy of that
        site applies.
      </p>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        {SITE.name} is a general audience reference tool. It does not knowingly collect personal information from anyone,
        including children under 13.
      </p>
    ),
  },
  {
    id: 'rights',
    title: 'Your choices and rights',
    body: (
      <>
        <p>
          Since we do not keep records about you, there is usually nothing for us to access, correct or delete. Depending on
          where you live, including under India's Digital Personal Data Protection Act, 2023, or the EU GDPR, you may still
          have rights over data held by the hosting provider or the USGS, and you can contact them directly.
        </p>
        <p>You can also use the site through a VPN or a privacy focused browser; it works the same way.</p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes and contact',
    body: (
      <p>
        If this policy changes, the date at the top of the page will change with it. Questions can be sent to{' '}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. See also the{' '}
        <Link to="/terms">terms and conditions</Link>.
      </p>
    ),
  },
]

export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy policy"
      intro={<p>How {SITE.name} handles information when you use it. In brief: it stores nothing about you.</p>}
      sections={sections}
    />
  )
}
