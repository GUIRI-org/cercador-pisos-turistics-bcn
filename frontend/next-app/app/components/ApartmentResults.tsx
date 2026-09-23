'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AddressGroup, ApartmentDetail as ApartmentDetailType } from '@/lib/types';
import { ApartmentDetail } from './StreetDetail';
import { ChoroplethMap } from './ChoroplethMap';
import { EPSG_25831 } from '../lib/geoUtils';
import { fetchApartmentMap } from '@/lib/api';
import { FaRegBuilding } from 'react-icons/fa6';


interface ApartmentResultsProps {
  title: string;
  streetName?: string;
  addressGroups: AddressGroup[];
  streetGroups?: AddressGroup[];
  loading?: boolean;
  onResetSearch?: () => void;
  /** Runs a new search for the clicked address of the street. */
  onSelectAddress?: (group: AddressGroup) => void;
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

const formatAddress = (group: AddressGroup, streetName?: string) => {
  const street = streetName || `${group.tipus_carrer || ''} ${group.carrer || ''}`.trim();
  const number = `${group.num1 ?? ''}${group.lletra1 || ''}`.trim();
  if (street && number) return `${street}, ${number}`;
  // Falls back to the raw address, adding the comma before its first number.
  return (group.address || '').replace(/\s+(\d)/, ', $1');
};

const formatArea = (group: AddressGroup) =>
  [group.nom_barri, group.nom_districte].filter(Boolean) as string[];

// Numeric floors/doors come first in ascending order, then the rest alphabetically.
const compareAscending = (a: string, b: string) => {
  const aNum = Number.parseInt(a, 10);
  const bNum = Number.parseInt(b, 10);
  const aIsNum = !Number.isNaN(aNum);
  const bIsNum = !Number.isNaN(bNum);

  if (aIsNum && bIsNum) return aNum - bNum;
  if (aIsNum) return -1;
  if (bIsNum) return 1;
  return a.localeCompare(b, 'ca');
};

const groupApartmentsByFloor = (apartments: ApartmentDetailType[]) => {
  const floors = new Map<string, Map<string, number>>();

  apartments.forEach((apt) => {
    const pis = normalizePis(apt.pis);
    const porta = String(apt.porta ?? '').trim() || '-';
    const doors = floors.get(pis) ?? new Map<string, number>();
    doors.set(porta, (doors.get(porta) ?? 0) + 1);
    floors.set(pis, doors);
  });

  return Array.from(floors, ([pis, doors]) => ({
    pis,
    doors: Array.from(doors, ([porta, count]) => ({ porta, count })).sort((a, b) => compareAscending(a.porta, b.porta)),
  })).sort((a, b) => compareAscending(a.pis, b.pis));
};

const compareByStreetNumber = (a: AddressGroup, b: AddressGroup) => {
  const aNum = a.num1 ?? Number.POSITIVE_INFINITY;
  const bNum = b.num1 ?? Number.POSITIVE_INFINITY;
  if (aNum !== bNum) return aNum - bNum;
  return (a.lletra1 || '').localeCompare(b.lletra1 || '', 'ca');
};

// Same file as the main map: every administrative level lives in it, picked through TIPUS_UA.
const BARRIS_GEOJSON = '/geo/barcelona-barris.geojson';

// Context only: the main layer still drives the zoom, so the view stays on the city shapes.
const COMARQUES_CONTEXT = {
  geoJsonUrl: '/geo/dts_comarques_8comarques.geojson',
  stroke: '#94a3b8',
  strokeWidth: 1.5,
};

const streetKeyOf = (group: AddressGroup) =>
  `${group.tipus_carrer ?? ''} ${group.carrer ?? ''}`.trim().toLowerCase();

// City view with the district of the address coloured, next to a district view highlighting its neighbourhood.
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

  // Translucent white squares for every other licensed address, so overlaps read as a density cloud.
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
    <div className="row g-3 my-3">
      <div className="col-12 col-md-3">
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
      </div>
      <div className="col-12 col-md-9">
        <h5 className="mb-1">{group.nom_barri || 'Barri'}</h5>
        <p className="text-gray-600">
          {areaTotals.neighborhood !== null ? `${areaTotals.neighborhood} habitatges turístics` : 'Carregant total…'}
        </p>
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
        <div className="form-check mt-2">
          <input
            className="form-check-input"
            type="checkbox"
            id={`show-other-apartments-${group.codi_barri ?? 'x'}-${group.num1 ?? 'x'}`}
            checked={showOtherApartments}
            onChange={(e) => setShowOtherApartments(e.target.checked)}
          />
          <label
            className="form-check-label"
            htmlFor={`show-other-apartments-${group.codi_barri ?? 'x'}-${group.num1 ?? 'x'}`}
          >
            Mostra la resta d&apos;habitatges turístics de la ciutat
          </label>
        </div>
      </div>
    </div>
  );
}

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
  streetName,
  addressGroups,
  streetGroups,
  loading,
  onResetSearch,
  onSelectAddress,
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

  const searchedKeys = useMemo(() => new Set(displayGroups.map(getAddressGroupKey)), [displayGroups]);

  const resultSignature = useMemo(
    () => `${shouldOpenFirstItem ? 'reset' : 'plain'}:${displayGroups.map(getAddressGroupKey).join('||')}`,
    [displayGroups, shouldOpenFirstItem]
  );
  const defaultOpenItems = shouldOpenFirstItem ? new Set<number>([0]) : new Set<number>();
  const [openState, setOpenState] = useState<{ signature: string; openItems: Set<number> }>({
    signature: resultSignature,
    openItems: defaultOpenItems,
  });


  if (loading) {
    return (
      <div className="container rounded-lg border border-white/40 bg-transparent p-4 backdrop-blur-sm">
        <p className="mt-2 text-gray-600">Cercant habitatges turístics...</p>
      </div>
    );
  }

  return (
    <div className={`d-flex flex-column gap-4 py-5`}>


      {!displayGroups.length && (
        <div className="alert alert-warning p-5 rounded-0 border container">
          <h4 className="alert-heading">No s&apos;han trobat habitatges d&apos;us turistic en <strong>{title}</strong></h4>
          <p className="">Probablement el pis que busques és il·legal</p>
          <hr></hr>
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
            className="container"
          >
            <ApartmentDetail group={group} allGroups={displayGroups} currentIndex={idx} streetName={streetName} />

            <AddressLocationMaps group={group} streetName={streetName} />
            <button
              type="button"
              className="btn btn-outline-secondary ms-auto"
              accessKey="e"
              title="Esborrar (Alt+E)"
              onClick={onResetSearch}
            >
              Esborrar
            </button>

          </div>
        );
      })}

      {chartGroups.length > 0 && (
        <section className="street-addresses bg-dark text-white py-5">
          <div className='container'>
            <h4>Adreces del mateix carrer amb llicència</h4>
            <p className="text-gray-600">Ordenades per número.</p>
            <div className="row row-cols-1 row-cols-md-4 g-3">
              {chartGroups.map((group) => {
                const isSearched = searchedKeys.has(getAddressGroupKey(group));
                return (
                  <div key={getAddressGroupKey(group)} className="col">
                    <button
                      type="button"
                      className={`card h-100 w-100 text-start${isSearched ? ' border-primary' : ''}`}
                      aria-current={isSearched ? 'true' : undefined}
                      onClick={() => onSelectAddress?.(group)}
                    >
                      <div className="card-body d-flex flex-row gap-3">
                        <FaRegBuilding className="fs-2" />
                        <div className="d-flex flex-column gap-1">
                          <h5 className="card-title mb-0">{formatAddress(group, streetName)}</h5>
                          {formatArea(group).map((area) => (
                            <span key={area} className="card-subtitle text-gray-600">{area}</span>
                          ))}
                          <span className="badge bg-secondary rounded-pill align-self-start mt-2">
                            {group.apartments_count} habitatges · {group.total_places} places
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <AddressNumberDistributionChart groups={chartGroups} />

    </div>
  );
}
