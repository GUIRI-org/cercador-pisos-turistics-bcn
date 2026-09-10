'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

interface AppNavbarProps {
  secondaryHref: string;
  secondaryLabel: string;
  compact?: boolean;
}

export function AppNavbar({ secondaryHref, secondaryLabel, compact = false }: AppNavbarProps) {
  const pathname = usePathname();
  const isMainActive = pathname === '/';

  return (

    <nav className="navbar navbar-expand-lg bg-body-tertiary">
      <div className="container">
        <Link
          className={`navbar-brand ${isMainActive ? 'fw-semibold text-primary' : ''}`}
          href="/"
          aria-current={isMainActive ? 'page' : undefined}
        >
          <img src={`${BASE}/guiri-gamba.svg`} alt="Guiri Gamba" width="32" height="32" className="d-inline-block" /> El Guiri
        </Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavAltMarkup" aria-controls="navbarNavAltMarkup" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNavAltMarkup">
          <div className="navbar-nav">
            <a className="nav-link active" aria-current="page" href="#">Home</a>
            <a className="nav-link" href="#">Features</a>
            <a className="nav-link" href="#">Pricing</a>
            <a className="nav-link disabled" aria-disabled="true">Disabled</a>
          </div>
        </div>
      </div>
    </nav>
  );
}
