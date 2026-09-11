'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { versions } from '../config/versions';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

interface AppNavbarProps {
  secondaryHref: string;
  secondaryLabel: string;
  compact?: boolean;
}

export function AppNavbar({
  secondaryHref,
  secondaryLabel,
  compact = false,
}: AppNavbarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isMainActive = pathname === '/';

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <nav className={`navbar navbar-expand-lg`} style={{ backgroundColor: '#FFF' }}>
      <div className="container">
        <Link
          className={`navbar-brand ${isMainActive ? 'fw-semibold text-primary' : ''}`}
          href="/"
          aria-current={isMainActive ? 'page' : undefined}
          onClick={closeMenu}
        >
          <img
            src={`${BASE}/guiri-gamba-cabeza.svg`}
            alt="Guiri Gamba"
            width="48"
            height="48"
            className="d-inline-block"
          />{' '}
          El Guiri
        </Link>

        <button
          className="navbar-toggler border-0"
          type="button"
          aria-controls="navbarNavAltMarkup"
          aria-expanded={isOpen}
          aria-label="Toggle navigation"
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="navbar-toggler-icon" />
        </button>

        {/* Avoid the bare `collapse` class: Tailwind emits `visibility: collapse` for it. */}
        <div
          className={`navbar-collapse ${isOpen ? '' : 'd-none'}`}
          id="navbarNavAltMarkup"
        >
          <div className="navbar-nav ms-auto">
            <Link
              className={`nav-link ${isMainActive ? 'active fw-semibold' : ''}`}
              href="/"
              aria-current={isMainActive ? 'page' : undefined}
              onClick={closeMenu}
            >
              Home
            </Link>

            {versions.map((version) => {
              const isActive = pathname === version.href;

              return (
                <Link
                  key={version.href}
                  className={`nav-link ${isActive ? 'active fw-semibold' : ''}`}
                  href={version.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={closeMenu}
                >
                  {version.title}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
