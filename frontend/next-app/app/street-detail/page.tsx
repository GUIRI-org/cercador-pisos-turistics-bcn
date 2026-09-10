'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function StreetDetailSummary() {
  const searchParams = useSearchParams();
  const address = searchParams.get('address')?.trim();

  return (
    <main className="container py-4">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="mb-2">Detall del carrer</h1>
          <p className="text-muted mb-0">
            Resum inicial de la cerca del carrer.
          </p>
        </div>

        <Link href="/search-v1" className="btn btn-outline-secondary btn-sm">
          Tornar al cercador
        </Link>
      </div>

      <section className="border rounded p-3 bg-white">
        <h2 className="h4 mb-3">Carrer seleccionat</h2>

        {address ? (
          <p className="mb-0">
            S&apos;ha obert el detall per: <strong>{address}</strong>
          </p>
        ) : (
          <p className="mb-0 text-muted">
            No s&apos;ha indicat cap adreça. Torna al cercador i selecciona un carrer.
          </p>
        )}
      </section>
    </main>
  );
}

export default function StreetDetailPage() {
  return (
    <Suspense fallback={<main className="container py-4">Carregant detall del carrer...</main>}>
      <StreetDetailSummary />
    </Suspense>
  );
}