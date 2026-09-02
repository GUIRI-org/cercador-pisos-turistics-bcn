import Link from 'next/link';
import { ParallaxContainer } from './components/ParallaxContainer';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

const versions = [
  {
    href: '/search-v1',
    title: 'Search v1',
    description: 'Current production search — stable address lookup and results.',
  },
  {
    href: '/search-v2',
    title: 'Search v2',
    description: 'Experimental iteration — new search features under development.',
  },
  {
    href: '/opendata-search',
    title: 'OpenData search',
    description: 'Alternative search backed by the OpenData BCN territory API.',
  },
];

export default function Home() {
  return (
    <ParallaxContainer>
      <nav className="navbar">
        <div className="container">
          <Link className="navbar-brand fw-semibold text-primary" href="/">
            <img src={`${BASE}/guiri-gamba.svg`} alt="Guiri Gamba" width="32" height="32" className="d-inline-block" /> El Guiri
          </Link>
        </div>
      </nav>
      <main className="container" style={{ maxWidth: '640px', minHeight: '100vh', paddingTop: '1rem', paddingBottom: '1rem' }}>
        <h1 className="text-3xl font-bold text-gray-900">
          Barcelona Tourist Apartments
        </h1>
        <p className="mt-2 text-gray-600">
          Choose a version to explore the tourist apartments search.
        </p>

        <div className="mt-6 d-flex flex-column gap-3">
          {versions.map((version) => (
            <Link
              key={version.href}
              href={version.href}
              className="card text-decoration-none p-3 border rounded"
            >
              <div className="fw-semibold text-gray-900">{version.title}</div>
              <div className="text-sm text-gray-600 mt-1">{version.description}</div>
            </Link>
          ))}
        </div>
      </main>
    </ParallaxContainer>
  );
}
