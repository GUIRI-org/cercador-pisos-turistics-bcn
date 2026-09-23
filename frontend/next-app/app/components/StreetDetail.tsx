'use client';

import type { AddressGroup } from '@/lib/types';
import { AddressMiniMap } from './AddressMiniMap';
import { FaRegBuilding } from 'react-icons/fa6';
import { MdOutlineDoorFront } from "react-icons/md";


interface ApartmentDetailProps {
  group: AddressGroup;
  allGroups: AddressGroup[];
  currentIndex: number;
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

export function ApartmentDetail({
  group,
  allGroups,
  currentIndex,
  streetName,
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

  const formatAddress = (group: AddressGroup) => {
    const street = streetName || `${group.tipus_carrer || ''} ${group.carrer || ''}`.trim();
    const number = `${group.num1 ?? ''}${group.lletra1 || ''}`.trim();
    if (street && number) return `${street}, ${number}`;
    // Falls back to the raw address, adding the comma before its first number.
    return (group.address || '').replace(/\s+(\d)/, ', $1');
  };

  const formatArea = (group: AddressGroup) =>
    [group.nom_barri, group.nom_districte].filter(Boolean) as string[];

  const totalDoors = Object.values(pisosGrouped).reduce((acc, pisData) => acc + Object.keys(pisData.portes).length, 0);
  const totalPlaces = Object.values(pisosGrouped).reduce((acc, pisData) => acc + pisData.totalPlaces, 0);
  const occupancyDensity = totalPlaces > 0 ? (totalDoors / totalPlaces) * 100 : 0;

  return (
    <div className="row">
      <div className="d-flex flex-column gap-2 col-12 col-md-3 pb-4">
        <FaRegBuilding className="fs-1" aria-hidden="true" />
        <h2>{formatAddress(group) || 'Address not available'}</h2>
        {formatArea(group).map((area) => (
          <p key={area} className="text-gray-600 mb-0">{area}</p>
        ))}
      </div>
      <div className="col col-md-auto">
        <h4 className="alert-heading">
          S'han trobat&nbsp;
          <strong>
            {totalDoors}&nbsp;habitatges</strong>&nbsp;amb llicencia d&apos;ús turístic
        </h4>
        <p className="">
          Si la teva adreça apareix a la llista, l&apos;habitatge disposa de llicència municipal.
        </p>
        <ul className="list-group floor-list">
          {Object.entries(pisosGrouped)
            .sort(([pisA], [pisB]) => {
              const aNum = Number.parseInt(pisA, 10);
              const bNum = Number.parseInt(pisB, 10);
              const aIsNum = !Number.isNaN(aNum);
              const bIsNum = !Number.isNaN(bNum);

              if (aIsNum && bIsNum) return aNum - bNum;
              if (aIsNum) return -1;
              if (bIsNum) return 1;

              return pisA.localeCompare(pisB, 'ca');
            })
            .map(([pis, pisData]) => (
              <li key={pis} className="d-flex align-items-stretch ">
                <div className="border-end p-2 me-2">
                  <small><strong>P</strong> {pis}</small>
                </div>

                <ul className="list-group list-group-horizontal flex-wrap p-2">
                  {Object.entries(pisData.portes)
                    .sort(([portaA], [portaB]) => portaA.localeCompare(portaB, 'ca'))
                    .map(([porta, portaPlaces]) => (
                      <li
                        key={`${pis}-${porta}`}
                        className="d-flex me-4"
                      >
                        <MdOutlineDoorFront className="inline-block me-2 fs-2" />
                        <div>
                          <small className="text-gray-600 d-block">
                            <strong>{formatAddress(group)}</strong>  {`${pis}${porta !== '-' ? ` - ${porta}` : ''}`}
                          </small>
                          <span className="d-inline-flex align-items-center flex-wrap gap-1">
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