'use client';

import { useMemo, useState } from 'react';
import { AddressGroup, ApartmentDetail } from '@/lib/types';
import { AddressMiniMap } from './AddressMiniMap';

interface ApartmentResultsProps {
  title: string;
  addressGroups: AddressGroup[];
  loading?: boolean;
  onResetSearch?: () => void;
}

const normalizePart = (value: string | number | null | undefined) => String(value ?? '').trim().toLowerCase();

const normalizePis = (value: string | number | null | undefined) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '-';

  if (/^\d+$/.test(rawValue)) {
    return rawValue.padStart(2, '0');
  }

  return rawValue;
};

const getAddressGroupKey = (group: AddressGroup) => {
  return [
    normalizePart(group.tipus_carrer),
    normalizePart(group.carrer),
    normalizePart(group.num1),
    normalizePart(group.lletra1),
    normalizePart(group.num2),
    normalizePart(group.lletra2),
    normalizePart(group.address),
    normalizePart(group.latitud_y),
    normalizePart(group.longitud_x),
  ].join('|');
};

const getApartmentKey = (apt: ApartmentDetail) => {
  return [
    normalizePart(apt.expedient),
    normalizePart(apt.registre_generalitat),
    normalizePart(apt.bloc),
    normalizePart(apt.portal),
    normalizePart(apt.escala),
    normalizePart(normalizePis(apt.pis)),
    normalizePart(apt.porta),
    normalizePart(apt.year),
    normalizePart(apt.num_places),
  ].join('|');
};

const dedupeAddressGroups = (groups: AddressGroup[]): AddressGroup[] => {
  const merged = new Map<string, AddressGroup>();

  groups.forEach((group) => {
    const groupKey = getAddressGroupKey(group);
    const existing = merged.get(groupKey);

    if (!existing) {
      merged.set(groupKey, {
        ...group,
        apartments: [...group.apartments],
      });
      return;
    }

    const apartmentsByKey = new Map<string, ApartmentDetail>();
    [...existing.apartments, ...group.apartments].forEach((apt) => {
      apartmentsByKey.set(getApartmentKey(apt), apt);
    });

    const uniqueApartments = Array.from(apartmentsByKey.values());
    const hasApartments = uniqueApartments.length > 0;
    const dedupedTotalPlaces = uniqueApartments.reduce((sum, apt) => sum + (apt.num_places || 0), 0);

    merged.set(groupKey, {
      ...existing,
      address: existing.address || group.address,
      tipus_carrer: existing.tipus_carrer ?? group.tipus_carrer,
      carrer: existing.carrer ?? group.carrer,
      num1: existing.num1 ?? group.num1,
      lletra1: existing.lletra1 ?? group.lletra1,
      num2: existing.num2 ?? group.num2,
      lletra2: existing.lletra2 ?? group.lletra2,
      codi_districte: existing.codi_districte ?? group.codi_districte,
      nom_districte: existing.nom_districte ?? group.nom_districte,
      codi_barri: existing.codi_barri ?? group.codi_barri,
      nom_barri: existing.nom_barri ?? group.nom_barri,
      longitud_x: existing.longitud_x ?? group.longitud_x,
      latitud_y: existing.latitud_y ?? group.latitud_y,
      apartments: uniqueApartments,
      apartments_count: hasApartments
        ? uniqueApartments.length
        : Math.max(existing.apartments_count, group.apartments_count),
      total_places: hasApartments
        ? dedupedTotalPlaces
        : Math.max(existing.total_places, group.total_places),
    });
  });

  return Array.from(merged.values());
};

export function ApartmentResults({
  title,
  addressGroups,
  loading,
  onResetSearch,
}: ApartmentResultsProps) {
  const shouldOpenFirstItem = !!onResetSearch;
  const showCollapsibleHeader = !shouldOpenFirstItem;
  const displayGroups = useMemo(() => dedupeAddressGroups(addressGroups), [addressGroups]);
  const resultSignature = useMemo(
    () => `${shouldOpenFirstItem ? 'reset' : 'plain'}:${displayGroups.map(getAddressGroupKey).join('||')}`,
    [displayGroups, shouldOpenFirstItem]
  );
  const defaultOpenItems = shouldOpenFirstItem ? new Set<number>([0]) : new Set<number>();
  const [openState, setOpenState] = useState<{ signature: string; openItems: Set<number> }>({
    signature: resultSignature,
    openItems: defaultOpenItems,
  });
  const openItems = openState.signature === resultSignature ? openState.openItems : defaultOpenItems;

  const toggleItem = (idx: number) => {
    setOpenState((prev) => {
      const baseItems = prev.signature === resultSignature ? prev.openItems : defaultOpenItems;
      const next = new Set(baseItems);

      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }

      return {
        signature: resultSignature,
        openItems: next,
      };
    });
  };

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

  if (!displayGroups.length) {
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
        <p className="mt-2 text-gray-600">No s&apos;han trobat habitatges d&apos;us turistic.</p>
      </div>
    );
  }

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
        {displayGroups.map((group, idx) => {
          const isPriorityResult = shouldOpenFirstItem && idx === 0;
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
          const hasCoordinates = group.longitud_x !== undefined && group.longitud_x !== null
            && group.latitud_y !== undefined && group.latitud_y !== null;
          const otherStreetMarkers = displayGroups
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

          const isOpen = showCollapsibleHeader ? openItems.has(idx) : true;

          return (
            <div
              key={idx}
              className={`bg-transparent p-3 d-flex flex-column gap-2 ${isPriorityResult ? 'rounded-3 border border-success-subtle bg-success-subtle' : ''}`}
            >
              {showCollapsibleHeader ? (
                <div
                  className="collapsible-item-header d-flex justify-content-between align-items-center"
                  role="button"
                  onClick={() => toggleItem(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  <h4 className="font-semibold text-gray-900 d-flex align-items-center gap-2 mb-0">
                    <span>{group.address || 'Adreça no disponible'}</span>
                  </h4>
                  <div className="d-flex align-items-center gap-3">
                    <h3 className="">
                      {group.apartments_count} habitatge(s) · {group.total_places} places
                    </h3>
                    <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </div>
                </div>
              ) : (
                <div className="d-flex align-items-center gap-3 mb-1">
                  <span className={`badge ${isPriorityResult ? 'text-bg-success' : 'text-bg-secondary'}`}>
                    #{idx + 1}
                  </span>
                  <h3 className="mb-0">
                    {group.apartments_count} habitatge(s) · {group.total_places} places
                  </h3>
                </div>
              )}
              {isOpen && (
                <div className="collapsible-content">
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
                      <div className="fw-semibold text-gray-800">Extended information</div>
                      {streetLabel && (
                        <div className="text-sm text-gray-600">Street: {streetLabel}</div>
                      )}
                      {numberLabel && (
                        <div className="text-sm text-gray-600">Number: {numberLabel}</div>
                      )}
                      {district && (
                        <div className="text-sm text-gray-600">District and neighborhood: {district}</div>
                      )}
                      {(group.codi_districte !== undefined || group.codi_barri !== undefined) && (
                        <div className="text-sm text-gray-600">
                          District code: {group.codi_districte ?? '-'} · Neighborhood code: {group.codi_barri ?? '-'}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
