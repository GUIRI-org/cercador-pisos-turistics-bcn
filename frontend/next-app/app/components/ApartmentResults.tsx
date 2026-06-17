'use client';

import { AddressGroup } from '@/lib/types';

interface ApartmentResultsProps {
  title: string;
  addressGroups: AddressGroup[];
  loading?: boolean;
  onResetSearch?: () => void;
}

export function ApartmentResults({
  title,
  addressGroups,
  loading,
  onResetSearch,
}: ApartmentResultsProps) {

  if (loading) {
    return (
      <div className="rounded-lg border border-white/40 bg-transparent p-4 backdrop-blur-sm">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <h4 className="font-semibold text-gray-800 mb-0">{title}</h4>
          {onResetSearch && (
            <button
              type="button"
              onClick={onResetSearch}
              className="btn btn-outline-danger btn-sm flex-shrink-0"
            >
              Reset search
            </button>
          )}
        </div>
        <p className="mt-2 text-gray-600">Cercant habitatges turístics...</p>
      </div>
    );
  }

  if (!addressGroups.length) {
    return (
      <div className="rounded-lg border border-white/40 bg-transparent p-4 backdrop-blur-sm">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <h4 className="font-semibold text-gray-800 mb-0">{title}</h4>
          {onResetSearch && (
            <button
              type="button"
              onClick={onResetSearch}
              className="btn btn-outline-danger btn-sm flex-shrink-0"
            >
              Reset search
            </button>
          )}
        </div>
        <p className="mt-2 text-gray-600">No s'han trobat habitatges d'ús turístic.</p>
      </div>
    );
  }

  const totalApartments = addressGroups.reduce((s, g) => s + g.apartments_count, 0);

  return (
    <div className="rounded-lg border border-white/40 bg-transparent p-4 backdrop-blur-sm">
      <div className="d-flex justify-content-between align-items-start gap-3">
        <h4 className="font-semibold text-gray-800 mb-0">
          {title}
        </h4>
        {onResetSearch && (
          <button
            type="button"
            onClick={onResetSearch}
            className="btn btn-outline-danger btn-sm flex-shrink-0"
          >
            Reset search
          </button>
        )}
      </div>
      <div className="mt-4 space-y-4">
        {addressGroups.map((group, idx) => {
          const district = [group.nom_districte, group.nom_barri]
            .filter(Boolean)
            .join(' · ');
          const hasCoordinates = group.longitud_x !== undefined && group.longitud_x !== null
            && group.latitud_y !== undefined && group.latitud_y !== null;
          const pisosGrouped = group.apartments.reduce<
            Record<string, { totalPlaces: number; portes: Record<string, number> }>
          >((acc, apt) => {
            const pisKey = apt.pis || '-';
            const portaKey = apt.porta || '-';
            const places = apt.num_places || 0;

            if (!acc[pisKey]) {
              acc[pisKey] = { totalPlaces: 0, portes: {} };
            }

            acc[pisKey].totalPlaces += places;
            acc[pisKey].portes[portaKey] = (acc[pisKey].portes[portaKey] || 0) + places;
            return acc;
          }, {});

          return (
            <div key={idx} className="bg-transparent p-3 d-flex flex-column gap-2">
              <div className="mb-2 text-sm text-gray-700">
                <div className="font-semibold text-gray-900">
                  {group.address || 'Adreça no disponible'}
                </div>
                {district && (
                  <div className="text-sm text-gray-600">{district}</div>
                )}
                {hasCoordinates && (
                  <div className="text-sm text-gray-600">
                    Longitud: {group.longitud_x} · Latitud: {group.latitud_y}
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  {group.apartments_count} habitatge(s) · {group.total_places} places
                </div>
              </div>
              <ul className="list-group list-group-flush">
                {Object.entries(pisosGrouped)
                  .sort(([pisA], [pisB]) => {
                    const aNum = Number.parseInt(pisA, 10);
                    const bNum = Number.parseInt(pisB, 10);
                    const aIsNum = !Number.isNaN(aNum);
                    const bIsNum = !Number.isNaN(bNum);

                    if (aIsNum && bIsNum) return bNum - aNum;
                    if (aIsNum) return -1;
                    if (bIsNum) return 1;
                    return pisB.localeCompare(pisA, 'ca');
                  })
                  .map(([pis, pisData]) => (
                    <li key={pis} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-center">
                        <span>Floor: {pis}</span>
                        <span className="badge text-bg-primary rounded-pill">{pisData.totalPlaces}</span>
                      </div>
                      <ul className="list-group list-group-horizontal">
                        {Object.entries(pisData.portes)
                          .sort(([portaA], [portaB]) => portaA.localeCompare(portaB, 'ca'))
                          .map(([porta, portaPlaces]) => (
                            <li key={`${pis}-${porta}`} className="list-group-item " style={{ width: '12%' }}>
                              <small className="me-2">P-{porta}:</small><br></br>
                              <span className="d-inline-flex align-items-center flex-wrap gap-1">
                                {Array.from({ length: Math.max(0, Math.round(portaPlaces)) }).map((_, index) => (
                                  <span
                                    key={`${pis}-${porta}-place-${index}`}
                                    className="d-inline-block rounded-sm border border-blue-200 bg-blue-100"
                                    style={{ width: '8px', height: '8px' }}
                                    title={`1 plaça de porta ${porta}`}
                                  />
                                ))}
                              </span>
                            </li>
                          ))}
                      </ul>

                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
