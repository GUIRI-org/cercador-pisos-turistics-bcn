'use client';

import { AddressGroup } from '@/lib/types';

interface ApartmentResultsProps {
  title: string;
  addressGroups: AddressGroup[];
  loading?: boolean;
}

export function ApartmentResults({
  title,
  addressGroups,
  loading,
}: ApartmentResultsProps) {
  const escapeHtml = (value?: string | number | null): string => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  if (loading) {
    return (
      <div className="rounded-lg bg-blue-50 p-4">
        <h4 className="font-semibold text-gray-800">{title}</h4>
        <p className="mt-2 text-gray-600">Cercant habitatges turístics...</p>
      </div>
    );
  }

  if (!addressGroups.length) {
    return (
      <div className="rounded-lg bg-blue-50 p-4">
        <h4 className="font-semibold text-gray-800">{title}</h4>
        <p className="mt-2 text-gray-600">No s'han trobat habitatges d'ús turístic.</p>
      </div>
    );
  }

  const totalApartments = addressGroups.reduce((s, g) => s + g.apartments_count, 0);

  return (
    <div className="rounded-lg bg-blue-50 p-4">
      <h4 className="font-semibold text-gray-800">
        {title} ({totalApartments} habitatge(s) en {addressGroups.length} adreça(es))
      </h4>
      <ul className="mt-4 space-y-4">
        {addressGroups.map((group, idx) => {
          const district = [group.nom_districte, group.nom_barri]
            .filter(Boolean)
            .join(' · ');

          return (
            <li key={idx} className="rounded bg-white p-3">
              <div className="font-semibold text-gray-900">
                {escapeHtml(group.address || 'Adreça no disponible')}
              </div>
              {district && (
                <div className="text-sm text-gray-600">{escapeHtml(district)}</div>
              )}
              <div className="text-sm text-gray-600">
                {group.apartments_count} habitatge(s) · {group.total_places} places
              </div>
              <ul className="mt-2 space-y-1 border-l-2 border-gray-300 pl-3">
                {group.apartments.map((apt, aptIdx) => {
                  const pisParta = [apt.pis, apt.porta].filter(Boolean).join('/');
                  return (
                    <li key={aptIdx} className="text-xs text-gray-700">
                      <span>Expedient: {escapeHtml(apt.expedient || '-')}</span>
                      <span> · </span>
                      <span>Registre: {escapeHtml(apt.registre_generalitat || '-')}</span>
                      <span> · </span>
                      <span>Places: {escapeHtml(String(apt.num_places ?? '-'))}</span>
                      {pisParta && (
                        <>
                          <span> · </span>
                          <span>Pis/Porta: {escapeHtml(pisParta)}</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
