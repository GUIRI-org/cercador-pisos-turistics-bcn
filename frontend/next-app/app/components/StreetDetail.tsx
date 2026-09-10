'use client';

import type { AddressGroup } from '@/lib/types';
import { AddressMiniMap } from './AddressMiniMap';

interface ApartmentDetailProps {
  group: AddressGroup;
  allGroups: AddressGroup[];
  currentIndex: number;
}

const normalizePis = (value: string | number | null | undefined) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '-';

  if (/^\d+$/.test(rawValue)) {
    return rawValue.padStart(2, '0');
  }

  return rawValue;
};

export function ApartmentDetail({
  group,
  allGroups,
  currentIndex,
}: ApartmentDetailProps) {
  const district = [group.nom_districte, group.nom_barri]
    .filter(Boolean)
    .join(' · ');

  const streetLabel = [group.tipus_carrer, group.carrer]
    .filter(Boolean)
    .join(' ');

  const numberLabel = [
    group.num1 !== undefined && group.num1 !== null ? `${group.num1}${group.lletra1 || ''}` : null,
    group.num2 !== undefined && group.num2 !== null ? `${group.num2}${group.lletra2 || ''}` : null,
  ]
    .filter(Boolean)
    .join(' - ');

  const hasCoordinates =
    group.longitud_x !== undefined &&
    group.longitud_x !== null &&
    group.latitud_y !== undefined &&
    group.latitud_y !== null;

  const otherStreetMarkers = allGroups
    .filter((other, otherIdx) => {
      const otherHasCoordinates =
        other.longitud_x !== undefined &&
        other.longitud_x !== null &&
        other.latitud_y !== undefined &&
        other.latitud_y !== null;

      return (
        otherIdx !== currentIndex &&
        otherHasCoordinates &&
        !!group.carrer &&
        !!other.carrer &&
        other.carrer === group.carrer
      );
    })
    .map((other) => ({
      lat: other.latitud_y as number,
      lng: other.longitud_x as number,
      label: other.address || undefined,
    }));

  const pisosGrouped = group.apartments.reduce<
    Record<string, { totalPlaces: number; portes: Record<string, number> }>
  >((acc, apt) => {
    const pisKey = normalizePis(apt.pis);
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
    <>
      <div className="mb-3 d-flex flex-column flex-md-row gap-3 align-items-start">
        {hasCoordinates && (
          <AddressMiniMap
            lat={group.latitud_y as number}
            lng={group.longitud_x as number}
            label={group.address || 'Adreça'}
            otherMarkers={otherStreetMarkers}
          />
        )}

        <div className="text-sm text-gray-700 d-grid gap-1">
          {streetLabel && (
            <div className="text-sm text-gray-600">Street: {streetLabel}</div>
          )}

          {numberLabel && (
            <div className="text-sm text-gray-600">Number: {numberLabel}</div>
          )}

          {district && (
            <div className="text-sm text-gray-600">
              District and neighborhood: {district}
            </div>
          )}

          {(group.codi_districte !== undefined || group.codi_barri !== undefined) && (
            <div className="text-sm text-gray-600">
              District code: {group.codi_districte ?? '-'} · Neighborhood code:{' '}
              {group.codi_barri ?? '-'}
            </div>
          )}

          {hasCoordinates && (
            <div className="text-sm text-gray-600">
              Longitud: {group.longitud_x} · Latitud: {group.latitud_y}
            </div>
          )}
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
              <div className="d-flex justify-content-between align-items-center py-2">
                <span>Floor: {pis}</span>
                <span className="badge text-bg-primary rounded-pill">
                  {pisData.totalPlaces}
                </span>
              </div>

              <ul className="list-group list-group-horizontal my-2">
                {Object.entries(pisData.portes)
                  .sort(([portaA], [portaB]) => portaA.localeCompare(portaB, 'ca'))
                  .map(([porta, portaPlaces]) => (
                    <li
                      key={`${pis}-${porta}`}
                      className="list-group-item"
                      style={{ width: '12%' }}
                    >
                      <small className="me-2">door {porta}</small>
                      <br />

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
    </>
  );
}