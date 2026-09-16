'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { homeSections } from '../config/sections';

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
    <nav className={`navbar navbar-expand-lg sticky-top shadow-sm`} style={{ backgroundColor: '#FFF' }}>
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
            {homeSections.map((section) => (
              <Link
                key={section.id}
                className="nav-link"
                href={isMainActive ? `#${section.id}` : `/#${section.id}`}
                onClick={closeMenu}
              >
                {section.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
