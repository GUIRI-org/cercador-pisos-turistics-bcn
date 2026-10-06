'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AddressGroup } from '@/lib/types';
import { FaRegBuilding } from 'react-icons/fa6';
import { FaMapMarkerAlt } from "react-icons/fa";

import { MdOutlineDoorBack } from "react-icons/md";
import { ChoroplethMap } from './ChoroplethMap';
import { EPSG_25831 } from '../lib/geoUtils';
import { fetchApartmentMap } from '@/lib/api';



interface ApartmentDetailProps {
  group: AddressGroup;
  streetName?: string;
  onResetSearch?: () => void;
}

const normalizePis = (value: string | number | null | undefined) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '-';

  if (/^\d+$/.test(rawValue)) {
    return rawValue.padStart(2, '0');
  }

  return rawValue;
};

// Named floors sort before numbered floors; BJ sorts first, while AT keeps its default position after the numbers.
const PIS_LABELS: Record<string, string> = {
  BJ: 'Baix',
  EN: 'Entresuelo',
  PR: 'Principal',
  AT: 'Àtic',
};
const PIS_SPECIAL_SORT_ORDER: Record<string, number> = { BJ: -3, EN: -2, PR: -1 };

// Renders a normalized pis key (e.g. "01") as an ordinal (e.g. "1º"); named/non-numeric keys are mapped or left untouched.
const formatPisDisplay = (pis: string) => {
  const label = PIS_LABELS[pis.toUpperCase()];
  if (label) return label;
  if (!/^\d+$/.test(pis)) return pis;
  return `${Number.parseInt(pis, 10)}ª planta`;
};

const formatPisAddressDisplay = (pis: string) => {
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

const formatAddress = (group: AddressGroup, streetName?: string) => {
  const street = streetName || `${group.tipus_carrer || ''} ${group.carrer || ''}`.trim();
  const number = `${group.num1 ?? ''}${group.lletra1 || ''}`.trim();
  if (street && number) return `${street}, ${number}`;
  return (group.address || '').replace(/\s+(\d)/, ', $1');
};

const BARRIS_GEOJSON = '/geo/barcelona-barris.geojson';

const COMARQUES_CONTEXT = {
  geoJsonUrl: '/geo/dts_comarques_8comarques.geojson',
  stroke: '#94a3b8',
  strokeWidth: 1.5,
};

function AddressLocationMaps({ group, streetName }: { group: AddressGroup; streetName?: string }) {
  const [cityGroups, setCityGroups] = useState<AddressGroup[] | null>(null);
  const [cityLoading, setCityLoading] = useState(true);
  const [showOtherApartments, setShowOtherApartments] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchApartmentMap().then((groups) => {
      if (!cancelled) setCityGroups(groups);
    }).finally(() => {
      if (!cancelled) setCityLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasDistrict = group.codi_districte !== undefined && group.codi_districte !== null;
  const hasNeighborhood = group.codi_barri !== undefined && group.codi_barri !== null;

  const addressPoints =
    group.longitud_x !== undefined && group.latitud_y !== undefined
      ? [{ longitude: group.longitud_x, latitude: group.latitud_y, label: formatAddress(group, streetName), radius: 4, color: '#dc2626' }]
      : [];

  const cityPoints = useMemo(() => {
    if (!showOtherApartments || !cityGroups) return [];

    return cityGroups
      .filter((other) => other.longitud_x !== undefined && other.latitud_y !== undefined)
      .map((other) => ({
        longitude: other.longitud_x as number,
        latitude: other.latitud_y as number,
        label: `${other.address} (${other.apartments_count} habitatges)`,
        radius: 2,
        shape: 'square' as const,
        color: '#ffffff',
        opacity: 0.4,
      }));
  }, [showOtherApartments, cityGroups]);

  const areaTotals = useMemo(() => {
    if (!cityGroups) return { district: null, neighborhood: null } as { district: number | null; neighborhood: number | null };

    const sumFor = (matches: (other: AddressGroup) => boolean) =>
      cityGroups.filter(matches).reduce((acc, other) => acc + (other.apartments_count || 0), 0);

    return {
      district: hasDistrict ? sumFor((other) => Number(other.codi_districte) === Number(group.codi_districte)) : null,
      neighborhood: hasNeighborhood ? sumFor((other) => Number(other.codi_barri) === Number(group.codi_barri)) : null,
    };
  }, [cityGroups, group, hasDistrict, hasNeighborhood]);

  if (!hasDistrict && !hasNeighborhood) return null;

  if (cityLoading) {
    return (
      <div className="row g-3 my-3">
        <div className="col-12">
          <div className="border rounded p-4 text-gray-600">Carregant la ubicació de l&apos;adreça...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="row g-3">
      {/* <div className="col-12 col-lg-4">
        <h5 className="mb-1">{group.nom_districte || 'Districte'}</h5>
        <p className="text-gray-600">
          {areaTotals.district !== null ? `${areaTotals.district} habitatges turístics` : 'Carregant total…'}
        </p>
        <div className="choropleth-square">
          <ChoroplethMap
            geoJsonUrl={BARRIS_GEOJSON}
            sourceCrs={EPSG_25831}
            filterProperty="TIPUS_UA"
            filterValue="DISTRICTE"
            codeProperty="DISTRICTE"
            labelProperty="NOM"
            contextLayer={COMARQUES_CONTEXT}
            data={hasDistrict ? [{ code: group.codi_districte as number, value: 1, label: group.nom_districte }] : []}
            points={[...cityPoints, ...addressPoints]}
            height="100%"
            showAreaLabels={false}
            showLegend={false}
          />
        </div>
      </div> */}
      <div className="col-12 position-relative">
        <div className="form-check position-absolute bottom-0 start-0 z-10 px-5 py-1">
          <input
            className="form-check-input"
            type="checkbox"
            id={`show-other-apartments-${group.codi_barri ?? 'x'}-${group.num1 ?? 'x'}`}
            checked={showOtherApartments}
            onChange={(e) => setShowOtherApartments(e.target.checked)}
          />
          <label
            className="form-check-label fs-6"
            htmlFor={`show-other-apartments-${group.codi_barri ?? 'x'}-${group.num1 ?? 'x'}`}
          >
            Mostra la resta d&apos;habitatges turístics de la ciutat
          </label>
        </div>
        {/* <h5 className="mb-1">{group.nom_barri || 'Barri'}</h5>
        <p className="text-gray-600">
          {areaTotals.neighborhood !== null ? `${areaTotals.neighborhood} habitatges turístics` : 'Carregant total…'}
        </p> */}
        <div className="choropleth-double">
          <ChoroplethMap
            geoJsonUrl={BARRIS_GEOJSON}
            sourceCrs={EPSG_25831}
            filterProperty="TIPUS_UA"
            filterValue="BARRI"
            boundaryFilterValue="DISTRICTE"
            codeProperty="BARRI"
            labelProperty="NOM"
            contextLayer={COMARQUES_CONTEXT}
            data={hasNeighborhood ? [{ code: group.codi_barri as number, value: 1, label: group.nom_barri }] : []}
            focusProperty="DISTRICTE"
            focusCode={hasDistrict ? (group.codi_districte as number) : null}
            points={[...cityPoints, ...addressPoints]}
            height="100%"
            showAreaLabels={false}
            showBasemap={false}
            showLegend={false}
          />
        </div>

      </div>
    </div>
  );
}

export function ApartmentDetail({
  group,
  streetName,
  onResetSearch,
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

  const totalDoors = Object.values(pisosGrouped).reduce((acc, pisData) => acc + Object.keys(pisData.portes).length, 0);

  return (
    <div className="street-detail-content">
      <div className="alert alert-info p-4 rounded-0 border container" role="alert">
        <h4 className="alert-heading fw-normal">
          <strong>{formatAddress(group) || 'Address not available'}</strong>, {totalDoors === 1 ? 's\'ha trobat' : 's\'han trobat'} <strong>{totalDoors}&nbsp;{totalDoors === 1 ? 'habitatge' : 'habitatges'}</strong>&nbsp;amb llicencia d&apos;ús turístic para un total de <strong>{group.total_places || 0}&nbsp;plaçes</strong>.
        </h4>

        <p className="mb-0">
          Si la teva adreça apareix a la llista, l&apos;habitatge disposa de llicència municipal.
        </p>
        {onResetSearch && (
          <>
            <hr></hr>
            <div className="d-flex align-items-start gap-3">
              <button type="button" className="btn btn-outline-secondary rounded-0 ms-auto" onClick={onResetSearch}>
                Esborrar cerca
              </button>
            </div>
          </>
        )}
      </div>
      <AddressLocationMaps group={group} streetName={streetName} />
      <ul className="list-group rounded-0 border-0 pb-3">
        <li className="list-group-item border-0">
          {(group.nom_barri || group.nom_districte) && (
            <small className="d-block">
              {group.nom_districte && <span >{group.nom_districte}</span>},
              {group.nom_barri && <span className="ms-1">{group.nom_barri}</span>}
            </small>
          )}
          <div className="d-flex flex-row gap-2 py-2">
            <p className="fs-5 mb-0 fw-normal">{formatAddress(group) || 'Address not available'}</p>
            <span className="ms-auto badge bg-secondary rounded-0">
              {group.apartments_count} {group.apartments_count === 1 ? 'habitatge' : 'habitatges'} · {group.total_places} {group.total_places === 1 ? 'plaça' : 'places'}
            </span>
          </div>
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
                        {/* <MdOutlineDoorBack className="fs-3" aria-hidden="true" /> */}
                        <p className="mb-0 flex-grow-1">
                          {formatAddress(group)}, {`${formatPisAddressDisplay(pis)} ${porta !== '-' ? ` - ${formatPortaDisplay(porta)}` : ''}${group.lletra1 || ''}`}

                          {/* <span className="d-inline-flex align-items-center flex-wrap gap-1 ms-2">
                            {Array.from({ length: Math.max(0, Math.round(portaPlaces)) }).map((_, index) => (
                              <span
                              key={`${pis}-${porta}-place-${index}`}
                              className="d-inline-block rounded-sm border border-blue-200 bg-gray-500"
                              style={{ width: '8px', height: '8px' }}
                              title={`1 plaça de porta ${porta}`}
                              />
                              ))}
                              </span> */}
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