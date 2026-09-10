import Link from 'next/link';
import { versions } from './config/versions';

export default function Home() {
  return (
    <main
      className="container"
      style={{
        maxWidth: '640px',
        minHeight: '100vh',
        paddingTop: '1rem',
        paddingBottom: '1rem',
      }}
    >
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
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="fw-semibold text-gray-900">{version.title}</div>
            <div className="text-sm text-gray-600 mt-1">
              {version.description}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
