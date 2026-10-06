'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { homeSections } from '../config/sections';

export function AppNavbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isMainActive = pathname === '/';

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <nav className={`navbar bg-white navbar-expand-lg sticky-top shadow-sm py-0 shadow-none`}>
      <div className="container">
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
