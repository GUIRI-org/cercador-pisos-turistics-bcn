'use client';

import { useState } from 'react';
import { AddressGroup } from '@/lib/types';
import { AddressMiniMap } from './AddressMiniMap';

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
  const [openItems, setOpenItems] = useState<Set<number>>(new Set([0]));

  const toggleItem = (idx: number) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

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
          const otherStreetMarkers = addressGroups
            .filter((other, otherIdx) => {
              const otherHasCoordinates = other.longitud_x !== undefined && other.longitud_x !== null
                && other.latitud_y !== undefined && other.latitud_y !== null;
              return otherIdx !== idx
                && otherHasCoordinates
                && !!group.carrer
                && !!other.carrer
                && other.carrer === group.carrer;
            })
            .map((other) => ({
              lat: other.latitud_y as number,
              lng: other.longitud_x as number,
              label: other.address || undefined,
            }));
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

          const isOpen = openItems.has(idx);

          return (
            <div key={idx} className="bg-transparent p-3 d-flex flex-column gap-2">
              <div
                className="collapsible-item-header d-flex justify-content-between align-items-center"
                role="button"
                onClick={() => toggleItem(idx)}
                style={{ cursor: 'pointer' }}
              >
                <div className="font-semibold text-gray-900">
                  {group.address || 'Adreça no disponible'}
                </div>
                <div className="d-flex align-items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {group.apartments_count} habitatge(s) · {group.total_places} places
                  </span>
                  <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </div>
              </div>
              <div className="collapsible-content" style={{ display: isOpen ? 'block' : 'none' }}>
                <div className="mb-2 d-flex flex-column flex-md-row gap-3 align-items-start">
                  {hasCoordinates && (
                    <AddressMiniMap
                      lat={group.latitud_y as number}
                      lng={group.longitud_x as number}
                      label={group.address || 'Adreça'}
                      otherMarkers={otherStreetMarkers}
                    />
                  )}
                  <div className="text-sm text-gray-700">

                    {district && (
                      <div className="text-sm text-gray-600">{district}</div>
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
                          <span className="badge text-bg-primary rounded-pill">{pisData.totalPlaces}</span>
                        </div>
                        <ul className="list-group list-group-horizontal my-2">
                          {Object.entries(pisData.portes)
                            .sort(([portaA], [portaB]) => portaA.localeCompare(portaB, 'ca'))
                            .map(([porta, portaPlaces]) => (
                              <li key={`${pis}-${porta}`} className="list-group-item " style={{ width: '12%' }}>
                                <small className="me-2">door {porta}</small><br></br>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
