'use client';

import type { AddressGroup } from '@/lib/types';

import { PIS_LABELS, comparePis, formatPisAddressDisplay, normalizePis } from '../lib/floors';
import { BuildingList } from './BuildingList';



interface ApartmentDetailProps {
  group: AddressGroup;
  streetName?: string;
}

// Renders a normalized pis key (e.g. "01") as an ordinal (e.g. "1º"); named/non-numeric keys are mapped or left untouched.
const formatPisDisplay = (pis: string) => {
  const label = PIS_LABELS[pis.toUpperCase()];
  if (label) return label;
  if (!/^\d+$/.test(pis)) return pis;
  return `${Number.parseInt(pis, 10)}ª planta`;
};

// Renders a door number (e.g. "02") as an ordinal (e.g. "2ª"); non-numeric doors are left untouched.
const formatPortaDisplay = (porta: string) => {
  if (!/^\d+$/.test(porta)) return porta;
  return `${Number.parseInt(porta, 10)}ª`;
};

const formatAddress = (group: AddressGroup, streetName?: string) => {
  const street = streetName || `${group.tipus_carrer || ''} ${group.carrer || ''}`.trim();
  const number = `${group.num1 ?? ''}${group.lletra1 || ''}`.trim();
  if (street && number) return `${street}, ${number}`;
  return (group.address || '').replace(/\s+(\d)/, ', $1');
};

export function ApartmentDetail({
  group,
  streetName,
}: ApartmentDetailProps) {
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
    <div className="street-detail-content">
      <ul className="list-group rounded-0">
        <li className="list-group-item p-0">
          <BuildingList groups={[group]} streetName={streetName} className="flex-grow-1" />
        </li>
        {Object.entries(pisosGrouped)
          .sort(([pisA], [pisB]) => comparePis(pisA, pisB))
          .map(([pis, pisData]) => (
            <li key={pis} className="border-0">
              <div className="bg-gray-200 px-3 py-1">
                <small>{formatPisDisplay(pis)}</small>
              </div>

              <ul className="list-group list-group-flush">
                {Object.entries(pisData.portes)
                  .sort(([portaA], [portaB]) => portaA.localeCompare(portaB, 'ca'))
                  .map(([porta, portaPlaces]) => (
                    <li
                      key={`${pis}-${porta}`}
                      className="list-group-item d-flex align-items-center bg-light"
                    >
                      <div className="flex-grow-1 d-flex flex-row gap-2 align-items-center">
                        <p className="mb-0 flex-grow-1">
                          {formatAddress(group)}, {`${formatPisAddressDisplay(pis)} ${porta !== '-' ? ` - ${formatPortaDisplay(porta)}` : ''}${group.lletra1 || ''}`}
                        </p>
                        <small className="badge bg-light rounded-0 text-dark">{portaPlaces} plaçes</small>
                      </div>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
      </ul>
    </div >

  );
}