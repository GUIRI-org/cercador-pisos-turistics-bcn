'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export function StreetDetailContent() {
  const searchParams = useSearchParams();
  const decodedAddress = searchParams.get('address')?.trim();

  return (
    <main className="container py-4">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="mb-2">Detall del carrer</h1>

          {decodedAddress ? (
            <p className="text-muted mb-0">
              Resultats detallats per: <strong>{decodedAddress}</strong>
            </p>
          ) : (
            <p className="text-danger mb-0">
              No s&apos;ha indicat cap adreça.
            </p>
          )}
        </div>

        <Link href="/search-v1" className="btn btn-outline-secondary btn-sm">
          Tornar al cercador
        </Link>
      </div>

      <section className="border rounded p-3 bg-white">
        <h2 className="h4 mb-3">Informació del carrer</h2>

        {decodedAddress ? (
          <p className="mb-0">
            Aquesta pàgina ja rep l&apos;adreça des de la llista. El següent pas és connectar-la amb la consulta de dades per mostrar el detall complet del carrer.
          </p>
        ) : (
          <p className="mb-0">
            Torna al cercador i selecciona un carrer per veure&apos;n el detall.
          </p>
        )}
      </section>
    </main>
  );
}