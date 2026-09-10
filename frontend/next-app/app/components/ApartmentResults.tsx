'use client';

import { useMemo, useState } from 'react';
import type { AddressGroup, ApartmentDetail as ApartmentDetailType } from '@/lib/types';
import { ApartmentDetail } from './StreetDetail';

interface ApartmentResultsProps {
  title: string;
  addressGroups: AddressGroup[];
  streetGroups?: AddressGroup[];
  loading?: boolean;
  onResetSearch?: () => void;
  singleResult?: boolean;
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

const getApartmentKey = (apt: ApartmentDetailType) => {
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

    const apartmentsByKey = new Map<string, ApartmentDetailType>();
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
  streetGroups,
  loading,
  onResetSearch,
  singleResult,
}: ApartmentResultsProps) {
  const shouldOpenFirstItem = !!onResetSearch;
  const displayGroups = useMemo(
    () => dedupeAddressGroups(addressGroups).sort(compareByStreetNumber),
    [addressGroups]
  );

  // The chart needs every number on the street; the result list only holds the searched address.
  const chartGroups = useMemo(
    () => dedupeAddressGroups(streetGroups?.length ? streetGroups : addressGroups).sort(compareByStreetNumber),
    [streetGroups, addressGroups]
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
  const [activeTab, setActiveTab] = useState<'resultats' | 'street-detail'>('resultats');


  if (loading) {
    return (
      <div className="container rounded-lg border border-white/40 bg-transparent p-4 backdrop-blur-sm">
        <p className="mt-2 text-gray-600">Cercant habitatges turístics...</p>
      </div>
    );
  }

  return (
    <div className={``}>

      <ul className="nav nav-tabs" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${activeTab === 'resultats' ? 'active' : ''}`}
            id="resultats-tab"
            type="button"
            role="tab"
            aria-controls="resultats"
            aria-selected={activeTab === 'resultats'}
            onClick={() => setActiveTab('resultats')}
          >
            Resultats
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            className={`nav-link ${activeTab === 'street-detail' ? 'active' : ''}`}
            id="street-detail-tab"
            type="button"
            role="tab"
            aria-controls="street-detail"
            aria-selected={activeTab === 'street-detail'}
            onClick={() => setActiveTab('street-detail')}
          >
            Detall del carrer
          </button>
        </li>
      </ul>

      <div className="tab-content py-5">
        <div
          className={`tab-pane ${activeTab === 'resultats' ? 'active' : ''}`}
          id="resultats"
          role="tabpanel"
          aria-labelledby="resultats-tab"
          tabIndex={0}
        >

          {!displayGroups.length && (
            <div className="container">
              <h4 className="font-semibold text-danger">Probablement el pis que busques és il·legal</h4>
              <p className="mt-2 text-black">No s&apos;han trobat habitatges d&apos;us turistic en la adreça indicada: <strong>{title}</strong></p>
              <div className="d-flex align-items-start gap-3">
                <a href="https://atencioenlinia.ajuntament.barcelona.cat/ca/fitxa/alta?cbDetall=3205" target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary">
                  Avisa'ns
                </a>
              </div>
            </div>
          )}

          {displayGroups.map((group, idx) => {
            return (
              <div
                key={idx}
                className="d-flex flex-column gap-1"
              >
                {singleResult && (
                  <h4>
                    S'han trobat&nbsp;
                    <strong>
                      {displayGroups.reduce((acc, g) => acc + (g.apartments_count || 0), 0)}&nbsp;habitatges amb llicencia d&apos;ús turístic</strong> en <strong>{group.address || 'Address not available'}</strong>
                  </h4>
                )}
                {singleResult && (
                  <p className="mb-0">
                    Si la teva adreça apareix a la llista, l&apos;habitatge disposa de llicència municipal.
                  </p>
                )}
                <div className="my-3">
                  <ul className="list-group list-group-flush">
                    {group.apartments.map((apt, aptIdx) => (
                      <li key={aptIdx} className="list-group-item d-flex justify-content-between align-items-start">
                        <p className="mb-0">
                          {group.tipus_carrer && <span>{group.tipus_carrer} </span>}
                          {group.carrer && <span>{group.carrer} </span>}
                          {group.num1 && <span>{group.num1}{group.lletra1 || ''}, </span>}
                          {apt.pis && <span>{normalizePis(apt.pis)} </span>}
                          {apt.porta && <span>{apt.porta}</span>}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
        <div
          className={`tab-pane ${activeTab === 'street-detail' ? 'active' : ''}`}
          id="street-detail"
          role="tabpanel"
          aria-labelledby="street-detail-tab"
          tabIndex={0}
        >
          <AddressNumberDistributionChart groups={chartGroups} />
        </div>
      </div>

    </div>
  );
}
