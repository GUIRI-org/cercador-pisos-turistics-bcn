import Link from 'next/link';
import { versions } from '../config/versions';

<ul className="navbar-nav">
  {/* ...existing nav items... */}

  {versions.map((version) => (
    <li key={version.href} className="nav-item">
      <Link
        href={version.href}
        className="nav-link"
        onClick={() => {
          // If your collapsed menu has state, close it here.
          // setIsOpen(false);
        }}
      >
        {version.title}
      </Link>
    </li>
  ))}
</ul>