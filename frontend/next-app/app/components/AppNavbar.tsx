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
  const isSecondaryActive = pathname === secondaryHref;

  return (
    <nav className={`navbar ${compact ? 'mb-2' : ''}`}>
      <div className={`container ${compact ? 'p-0' : ''}`}>
        <Link
          className={`navbar-brand ${isMainActive ? 'fw-semibold text-primary' : ''}`}
          href="/"
          aria-current={isMainActive ? 'page' : undefined}
        >
          <img src={`${BASE}/guiri-gamba.svg`} alt="Guiri Gamba" width="32" height="32" className="d-inline-block" /> El Guiri
        </Link>
        <Link
          href={secondaryHref}
          className={`btn btn-sm ${isSecondaryActive ? 'btn-secondary' : 'btn-outline-secondary'}`}
          aria-current={isSecondaryActive ? 'page' : undefined}
        >
          {secondaryLabel}
        </Link>
      </div>
    </nav>
  );
}
