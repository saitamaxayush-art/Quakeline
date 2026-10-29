import { Link } from 'react-router-dom'
import { Logo } from './Header'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link to="/explore" className="brand brand-light" aria-label="Quakeline explorer" viewTransition>
            <Logo size={30} />
            <span>Quakeline</span>
          </Link>
          <p>
            A browser for the public earthquake feeds published by the U.S. Geological Survey. Quakeline is an independent
            project and is not affiliated with or endorsed by the USGS.
          </p>
        </div>

        <div>
          <h2 className="footer-h">Data</h2>
          <ul className="footer-list">
            <li>
              <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php" target="_blank" rel="noreferrer">
                USGS GeoJSON summary feeds
              </a>
            </li>
            <li>
              <a href="https://www.usgs.gov/programs/earthquake-hazards" target="_blank" rel="noreferrer">
                Earthquake Hazards Program
              </a>
            </li>
            <li>
              <Link to="/credits" viewTransition>
                Images, textures and station data
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="footer-h">Site</h2>
          <ul className="footer-list">
            <li>
              <Link to="/" viewTransition>
                The story
              </Link>
            </li>
            <li>
              <Link to="/explore" viewTransition>
                Explorer
              </Link>
            </li>
            <li>
              <Link to="/privacy" viewTransition>
                Privacy policy
              </Link>
            </li>
            <li>
              <Link to="/terms" viewTransition>
                Terms and conditions
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="wrap footer-base">
        <span>© {year} Quakeline</span>
        <span>Event data is public domain, courtesy of the USGS.</span>
      </div>
    </footer>
  )
}
