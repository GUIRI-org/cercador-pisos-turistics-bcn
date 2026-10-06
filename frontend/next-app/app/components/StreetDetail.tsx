'use client';

import type { AddressGroup } from '@/lib/types';
import { FaRegBuilding } from 'react-icons/fa6';


interface ApartmentDetailProps {
  group: AddressGroup;
  streetName?: string;
}

const normalizePis = (value: string | number | null | undefined) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '-';

  if (/^\d+$/.test(rawValue)) {
    return rawValue.padStart(2, '0');
  }

  return rawValue;
};

// Named floors below the numbered ones; EN/PR sort before "1º", AT keeps its default (after the numbers) position.
const PIS_LABELS: Record<string, string> = {
  EN: 'Entresuelo',
  PR: 'Principal',
  AT: 'Àtic',
};
const PIS_SPECIAL_SORT_ORDER: Record<string, number> = { EN: -2, PR: -1 };

// Renders a normalized pis key (e.g. "01") as an ordinal (e.g. "1º"); named/non-numeric keys are mapped or left untouched.
const formatPisDisplay = (pis: string) => {
  const label = PIS_LABELS[pis.toUpperCase()];
  if (label) return label;
  if (!/^\d+$/.test(pis)) return pis;
  return `${Number.parseInt(pis, 10)}º`;
};

const comparePis = (pisA: string, pisB: string) => {
  const aSpecial = PIS_SPECIAL_SORT_ORDER[pisA.toUpperCase()];
  const bSpecial = PIS_SPECIAL_SORT_ORDER[pisB.toUpperCase()];

  if (aSpecial !== undefined || bSpecial !== undefined) {
    if (aSpecial !== undefined && bSpecial !== undefined) return aSpecial - bSpecial;
    return aSpecial !== undefined ? -1 : 1;
  }

  const aNum = Number.parseInt(pisA, 10);
  const bNum = Number.parseInt(pisB, 10);
  const aIsNum = !Number.isNaN(aNum);
  const bIsNum = !Number.isNaN(bNum);

  if (aIsNum && bIsNum) return aNum - bNum;
  if (aIsNum) return -1;
  if (bIsNum) return 1;

  return pisA.localeCompare(pisB, 'ca');
};

// Renders a door number (e.g. "02") as an ordinal (e.g. "2ª"); non-numeric doors are left untouched.
const formatPortaDisplay = (porta: string) => {
  if (!/^\d+$/.test(porta)) return porta;
  return `${Number.parseInt(porta, 10)}ª`;
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

  const formatAddress = (group: AddressGroup) => {
    const street = streetName || `${group.tipus_carrer || ''} ${group.carrer || ''}`.trim();
    const number = `${group.num1 ?? ''}${group.lletra1 || ''}`.trim();
    if (street && number) return `${street}, ${number}`;
    // Falls back to the raw address, adding the comma before its first number.
    return (group.address || '').replace(/\s+(\d)/, ', $1');
  };

  const totalDoors = Object.values(pisosGrouped).reduce((acc, pisData) => acc + Object.keys(pisData.portes).length, 0);

  return (
    <div className="row">
      <div className="col col-md-auto">
        <div className="d-flex flex-row gap-2 pb-4">
          <FaRegBuilding className="fs-3" aria-hidden="true" />
          <h2>{formatAddress(group) || 'Address not available'}</h2>
        </div>
        <h4 className="alert-heading">
          S&apos;han trobat&nbsp;
          <strong>
            {totalDoors}&nbsp;habitatges</strong>&nbsp;amb llicencia d&apos;ús turístic
        </h4>
        <p className="">
          Si la teva adreça apareix a la llista, l&apos;habitatge disposa de llicència municipal.
        </p>
        <ul className="list-group">
          {Object.entries(pisosGrouped)
            .sort(([pisA], [pisB]) => comparePis(pisA, pisB))
            .map(([pis, pisData]) => (
              <li key={pis} className="">
                {/* <div className="border-bottom">
                  <small>{formatPisDisplay(pis)}</small>
                </div> */}

                <ul className="list-group">
                  {Object.entries(pisData.portes)
                    .sort(([portaA], [portaB]) => portaA.localeCompare(portaB, 'ca'))
                    .map(([porta, portaPlaces]) => (
                      <li
                        key={`${pis}-${porta}`}
                        className="d-flex p-3 bg-body align-items-center mb-2"
                      >
                        <div className="flex-grow-1">
                          <strong className="text-gray-600 d-block">
                            {formatAddress(group)}
                          </strong>
                          <span className="text-gray-600 d-inline">
                            {`${formatPisDisplay(pis)}${porta !== '-' ? ` - ${formatPortaDisplay(porta)}` : ''}${group.lletra1 || ''}`}
                          </span>
                          <span className="d-inline-flex align-items-center flex-wrap gap-1 ms-2">
                            {Array.from({ length: Math.max(0, Math.round(portaPlaces)) }).map((_, index) => (
                              <span
                                key={`${pis}-${porta}-place-${index}`}
                                className="d-inline-block rounded-sm border border-blue-200 bg-gray-500"
                                style={{ width: '8px', height: '8px' }}
                                title={`1 plaça de porta ${porta}`}
                              />
                            ))}
                          </span>
                        </div>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
        </ul>
      </div>

    </div>
  );
}