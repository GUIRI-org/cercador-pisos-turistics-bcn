'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export function SiteFooter() {
  const searchParams = useSearchParams();

  // The dashboard only reads the street and number, so unit filters are not forwarded.
  const dashboardParams = new URLSearchParams();
  for (const key of ['tipus_via', 'carrer', 'num']) {
    const value = searchParams.get(key)?.trim();
    if (value) dashboardParams.set(key, value);
  }
  const dashboardQuery = dashboardParams.toString();
  const dashboardHref = dashboardQuery ? `/dashboard?${dashboardQuery}` : '/dashboard';

  return (
    <footer className="site-footer bg-white">
      <div className="container py-5">
        <div className="row g-4">
          <div className="col-12 col-md-5">
            <a className="site-footer__brand" href="#seccio-introduccio">El Guiri</a>
            <p className="site-footer__summary">
              Informació ciutadana sobre habitatges d&apos;ús turístic a Barcelona, a partir de dades obertes.
            </p>
          </div>

          <nav className="col-6 col-md-3" aria-label="Navegació del peu de pàgina">
            <h2 className="site-footer__heading">Explora</h2>
            <ul className="site-footer__links">
              <li><Link href="/map">Mapa de Barcelona</Link></li>
              <li><Link href={dashboardHref}>Tauler de control</Link></li>
            </ul>
          </nav>

          <div className="col-6 col-md-4">
            <h2 className="site-footer__heading">Contacte</h2>
            <p className="site-footer__summary">Tens preguntes o vols compartir informació?</p>
            <a className="site-footer__link" href="mailto:contacte@elguiri.cat">contacte@elguiri.cat</a>
          </div>
        </div>

        <div className="site-footer__bottom">
          <span>&copy; 2026 El Guiri. Tots els drets reservats.</span>
          <div className="site-footer__legal" aria-label="Informació legal">
            <span>Avís legal</span>
            <span>Privacitat</span>
            <span>Accessibilitat</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
