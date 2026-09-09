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

const compareByStreetNumber = (a: AddressGroup, b: AddressGroup) => {
  const aNum = a.num1 ?? Number.POSITIVE_INFINITY;
  const bNum = b.num1 ?? Number.POSITIVE_INFINITY;
  if (aNum !== bNum) return aNum - bNum;
  return (a.lletra1 || '').localeCompare(b.lletra1 || '', 'ca');
};

// Each district gets a fixed hue; neighbourhoods within it are shades (gradient) of that hue.
const hashStringToHue = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
};

function buildDistrictColorScale(groups: AddressGroup[]) {
  const districtHues = new Map<string, number>();
  const neighborhoodsByDistrict = new Map<string, string[]>();

  groups.forEach((group) => {
    const district = group.nom_districte || 'Sense districte';
    const neighborhood = group.nom_barri || 'Sense barri';

    if (!districtHues.has(district)) {
      districtHues.set(district, hashStringToHue(district));
    }

    const neighborhoods = neighborhoodsByDistrict.get(district) || [];
    if (!neighborhoods.includes(neighborhood)) {
      neighborhoods.push(neighborhood);
    }
    neighborhoodsByDistrict.set(district, neighborhoods);
  });

  neighborhoodsByDistrict.forEach((neighborhoods) => neighborhoods.sort((a, b) => a.localeCompare(b, 'ca')));

  const neighborhoodLightness = new Map<string, number>();
  neighborhoodsByDistrict.forEach((neighborhoods, district) => {
    const count = neighborhoods.length;
    neighborhoods.forEach((neighborhood, idx) => {
      const lightness = count > 1 ? 35 + (idx / (count - 1)) * 35 : 45;
      neighborhoodLightness.set(`${district}||${neighborhood}`, lightness);
    });
  });

  const colorFor = (district: string, neighborhood: string) => {
    const hue = districtHues.get(district) ?? 210;
    const lightness = neighborhoodLightness.get(`${district}||${neighborhood}`) ?? 45;
    return `hsl(${hue}, 60%, ${lightness}%)`;
  };

  return { districtHues, neighborhoodsByDistrict, colorFor };
}

type DistributionBar = {
  key: string;
  num: number;
  apartments: number;
  places: number;
  district: string;
  neighborhood: string;
};

type DistributionMetric = 'apartments' | 'places';

const METRIC_LABELS: Record<DistributionMetric, string> = {
  apartments: 'apartaments',
  places: 'places',
};

type DistributionColumn =
  | { type: 'bar'; bar: DistributionBar }
  | { type: 'ellipsis' };

// Gaps wider than this between consecutive street numbers collapse into a single "…" column.
const MAX_NUMBER_GAP_BEFORE_ELLIPSIS = 12;

// Fixed column widths so bars stay legible and the chart can overflow its container instead of squeezing.
const BAR_COLUMN_WIDTH = 18;
const ELLIPSIS_COLUMN_WIDTH = 14;
const Y_AXIS_WIDTH = 26;

// Columns are built once from every number on the street (both parities) so the odd/even
// charts line up on the same axis instead of each compressing gaps independently.
function buildSharedColumns(nums: number[], startNum: number): DistributionColumn[] {
  const sorted = Array.from(new Set(nums)).sort((a, b) => a - b);
  const columns: DistributionColumn[] = [];

  if (sorted.length === 0 || sorted[0] !== startNum) {
    columns.push({ type: 'bar', bar: { key: String(startNum), num: startNum, apartments: 0, places: 0, district: '', neighborhood: '' } });
  }

  let prevNum: number | null = columns.length ? startNum : null;
  sorted.forEach((num) => {
    if (prevNum !== null && num - prevNum > MAX_NUMBER_GAP_BEFORE_ELLIPSIS) {
      columns.push({ type: 'ellipsis' });
    }
    columns.push({ type: 'bar', bar: { key: String(num), num, apartments: 0, places: 0, district: '', neighborhood: '' } });
    prevNum = num;
  });

  return columns;
}

// Fills a shared column layout with the real bar data available for one parity, leaving the rest empty.
function fillColumns(sharedColumns: DistributionColumn[], barsByNum: Map<number, DistributionBar>): DistributionColumn[] {
  return sharedColumns.map((column) => {
    if (column.type === 'ellipsis') return column;
    const bar = barsByNum.get(column.bar.num);
    return bar ? { type: 'bar', bar } : column;
  });
}

function NumberAxisLabels({ columns }: { columns: DistributionColumn[] }) {
  return (
    <div className="d-flex mt-2" style={{ gap: '4px' }}>
      <div className="flex-shrink-0" style={{ width: `${Y_AXIS_WIDTH}px` }} />
      <div className="d-flex" style={{ gap: '2px' }}>
        {columns.map((column, idx) => (
          <div
            key={`label-${idx}`}
            style={{
              flex: `0 0 ${column.type === 'ellipsis' ? ELLIPSIS_COLUMN_WIDTH : BAR_COLUMN_WIDTH}px`,
              fontSize: '0.6rem',
              textAlign: 'center',
              color: '#666',
            }}
          >
            {column.type === 'ellipsis' ? '···' : column.bar.key}
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionChart({
  title,
  titlePlacement = 'top',
  columns,
  colorFor,
  maxValue,
  metric,
  invertY = false,
}: {
  title: string;
  titlePlacement?: 'top' | 'bottom';
  columns: DistributionColumn[];
  colorFor: (district: string, neighborhood: string) => string;
  maxValue: number;
  metric: DistributionMetric;
  invertY?: boolean;
}) {
  const chartHeight = 110;
  // Ticks read top-to-bottom: max→0 normally, or 0→max when the axis is inverted.
  const yTicks = (invertY ? [0, 0.25, 0.5, 0.75, 1] : [1, 0.75, 0.5, 0.25, 0]).map((fraction) =>
    Math.round(maxValue * fraction)
  );

  const titleEl = <div className="text-sm text-gray-600 mb-1">{title}</div>;

  return (
    <div className="mt-2">
      {titlePlacement === 'top' && titleEl}
      <div className="d-flex" style={{ gap: '4px' }}>
        <div
          className="d-flex flex-column justify-content-between text-end flex-shrink-0"
          style={{
            height: chartHeight,
            fontSize: '0.6rem',
            color: '#666',
            width: `${Y_AXIS_WIDTH}px`,
            position: 'sticky',
            left: 0,
            background: '#f9fafb',
            zIndex: 1,
          }}
        >
          {yTicks.map((tick, idx) => (
            <div key={idx}>{tick}</div>
          ))}
        </div>
        <div
          className="position-relative flex-shrink-0"
          style={{
            height: chartHeight,
            width: columns.reduce((sum, c) => sum + (c.type === 'ellipsis' ? ELLIPSIS_COLUMN_WIDTH : BAR_COLUMN_WIDTH) + 2, 0),
            borderLeft: '1px solid #ccc',
            ...(invertY ? { borderTop: '1px solid #ccc' } : { borderBottom: '1px solid #ccc' }),
          }}
        >
          {yTicks.map((_, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(idx / (yTicks.length - 1)) * 100}%`,
                borderTop: '1px dashed #e0e0e0',
              }}
            />
          ))}
          <div className={`d-flex h-100 ${invertY ? 'align-items-start' : 'align-items-end'}`} style={{ gap: '2px' }}>
            {columns.map((column, idx) => {
              if (column.type === 'ellipsis') {
                return (
                  <div
                    key={`ellipsis-${idx}`}
                    className={`d-flex justify-content-center ${invertY ? 'align-items-start' : 'align-items-end'}`}
                    style={{ flex: `0 0 ${ELLIPSIS_COLUMN_WIDTH}px`, height: '100%' }}
                  >
                    <span style={{ fontSize: '0.7rem', color: '#999' }}>···</span>
                  </div>
                );
              }

              const { bar } = column;
              const value = metric === 'places' ? bar.places : bar.apartments;
              const heightPct = maxValue > 0 ? (value / maxValue) * 100 : 0;

              return (
                <div
                  key={`${bar.key}-${idx}`}
                  title={
                    bar.district
                      ? `Núm ${bar.key}: ${value} ${METRIC_LABELS[metric]} · ${bar.district} · ${bar.neighborhood}`
                      : `Núm ${bar.key}`
                  }
                  style={{
                    flex: `0 0 ${BAR_COLUMN_WIDTH}px`,
                    height: `${heightPct}%`,
                    background: bar.district ? colorFor(bar.district, bar.neighborhood) : 'transparent',
                    borderRadius: invertY ? '0 0 2px 2px' : '2px 2px 0 0',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      {titlePlacement === 'bottom' && titleEl}
    </div>
  );
}

function AddressNumberDistributionChart({ groups }: { groups: AddressGroup[] }) {
  const [metric, setMetric] = useState<DistributionMetric>('apartments');

  const bars: DistributionBar[] = groups
    .filter((group) => group.num1 !== undefined && group.num1 !== null)
    .map((group) => ({
      key: `${group.num1}${group.lletra1 || ''}`,
      num: group.num1 as number,
      apartments: group.apartments_count,
      places: group.total_places,
      district: group.nom_districte || 'Sense districte',
      neighborhood: group.nom_barri || 'Sense barri',
    }));

  if (bars.length < 2) return null;

  const { districtHues, neighborhoodsByDistrict, colorFor } = buildDistrictColorScale(groups);
  // Same shared column layout (numbers + ellipsis breaks) for both charts, so numbers line up on one axis.
  const sharedColumns = buildSharedColumns(bars.map((bar) => bar.num), 1);
  const oddColumns = fillColumns(sharedColumns, new Map(bars.filter((bar) => bar.num % 2 !== 0).map((bar) => [bar.num, bar])));
  const evenColumns = fillColumns(sharedColumns, new Map(bars.filter((bar) => bar.num % 2 === 0).map((bar) => [bar.num, bar])));
  // Shared across both charts so the two sides of the street stay proportionally comparable.
  const maxValue = Math.max(...bars.map((bar) => (metric === 'places' ? bar.places : bar.apartments)), 1);

  return (
    <div className="mb-3 p-2 rounded border border-gray-200 bg-gray-50">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <div className="text-sm text-gray-600">Distribució per número de carrer (color = districte, degradat = barri)</div>
        <div className="btn-group btn-group-sm" role="group" aria-label="Mètrica de la distribució">
          <button
            type="button"
            className={`btn ${metric === 'apartments' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setMetric('apartments')}
          >
            Apartaments
          </button>
          <button
            type="button"
            className={`btn ${metric === 'places' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setMetric('places')}
          >
            Places
          </button>
        </div>
      </div>
      {/* Single shared horizontal scrollbar for all three rows, so they always stay in sync and use the full available width before scrolling. */}
      <div style={{ overflowX: 'auto' }}>
        <DistributionChart title="Números senars" columns={oddColumns} colorFor={colorFor} maxValue={maxValue} metric={metric} />
        <NumberAxisLabels columns={sharedColumns} />
        <DistributionChart
          title="Números parells"
          titlePlacement="bottom"
          columns={evenColumns}
          colorFor={colorFor}
          maxValue={maxValue}
          metric={metric}
          invertY
        />
      </div>

      {/* Legend: district = master color swatch, neighbourhood swatches = gradient within that district */}
      <div className="mt-3 d-flex flex-column gap-2">
        {Array.from(neighborhoodsByDistrict.entries()).map(([district, neighborhoods]) => (
          <div key={district} className="d-flex align-items-center flex-wrap gap-2">
            <span
              className="d-inline-block rounded-sm"
              style={{ width: '10px', height: '10px', background: `hsl(${districtHues.get(district)}, 60%, 45%)`, flexShrink: 0 }}
            />
            <span className="text-sm text-gray-700 fw-semibold">{district}</span>
            <span className="d-flex align-items-center flex-wrap gap-2 ms-2">
              {neighborhoods.map((neighborhood) => (
                <span key={neighborhood} className="d-flex align-items-center gap-1">
                  <span
                    className="d-inline-block rounded-sm"
                    style={{ width: '8px', height: '8px', background: colorFor(district, neighborhood) }}
                  />
                  <span className="text-gray-600" style={{ fontSize: '0.7rem' }}>{neighborhood}</span>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApartmentResults({
  title,
  addressGroups,
  loading,
  onResetSearch,
}: ApartmentResultsProps) {
  const shouldOpenFirstItem = !!onResetSearch;
  const showCollapsibleHeader = !shouldOpenFirstItem;
  const displayGroups = useMemo(
    () => dedupeAddressGroups(addressGroups).sort(compareByStreetNumber),
    [addressGroups]
  );
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
      <div className="container rounded-lg border border-white/40 bg-transparent p-4 backdrop-blur-sm">
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
      <div className="container rounded-lg border border-white/40 bg-transparent p-4 backdrop-blur-sm">
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
        <p className="mt-2 text-gray-600">No s&apos;han trobat habitatges d&apos;us turistic, el pis que busques és il·legal.</p>
      </div>
    );
  }

  return (
    <div className="">
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
      <AddressNumberDistributionChart groups={displayGroups} />
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
              className={`bg-white p-3 d-flex flex-column gap-1 ${isPriorityResult ? 'rounded-3 border border-success-subtle bg-success-subtle' : 'bg-white'}`}
            >
              {showCollapsibleHeader ? (
                <div
                  className="collapsible-item-header position-relative"
                  role="button"
                  onClick={() => toggleItem(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  <h4 className="font-semibold text-gray-900 d-flex align-items-center gap-2 mb-0">
                    <span>{group.address || 'Address not available'}</span>
                  </h4>
                  <h5 className="">
                    {group.total_places} places across {group.apartments_count} apartment(s)
                  </h5>
                  {district && (
                    <div className="text-sm text-gray-600">{district}</div>
                  )}
                  <div className="position-absolute end-0 top-0 d-flex align-items-center gap-3">
                    <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </div>
                </div>
              ) : (
                <div className="d-flex flex-column gap-1 mb-1">
                  <h5 className="mb-0">
                    {group.total_places} places across {group.apartments_count} apartment(s)
                  </h5>
                  {district && (
                    <div className="text-sm text-gray-600">{district}</div>
                  )}
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
