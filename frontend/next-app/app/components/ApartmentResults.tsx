'use client';

import { memo, useMemo, useState, type RefObject } from 'react';
import type { AddressGroup } from '@/lib/types';
import { ApartmentDetail } from './StreetDetail';
import { ChoroplethMap, type ChoroplethPoint } from './ChoroplethMap';
import { EPSG_25831 } from '../lib/geoUtils';
import { getDistrictColor, hashStringToHue } from '../lib/districtColors';
import { dedupeAddressGroups, compareByStreetNumber, formatAddress, formatStreetName, getAddressGroupKey } from '../lib/addressGroups';


interface ApartmentResultsProps {
  title: string;
  streetName?: string;
  addressGroups: AddressGroup[];
  reference?: RefObject<HTMLElement | null>;
  loading?: boolean;
  onResetSearch?: () => void;
}

function SelectedAddressAnnotation({
  address,
  streetName,
}: {
  address: AddressGroup | null;
  streetName?: string;
}) {
  if (!address) return null;

  return (
    <p className="small text-gray-600 mb-2">
      Adreça seleccionada: <strong>{formatAddress(address, streetName)}</strong>
    </p>
  );
}

const STREET_MAP_GEOJSON = '/geo/barcelona-barris.geojson';

export function StreetAddressMap({
  groups,
  streetName,
  selectedAddress,
}: {
  groups: AddressGroup[];
  streetName?: string;
  selectedAddress: AddressGroup | null;
}) {
  const locatedAddresses = groups.filter(
    (group) =>
      group.total_places > 0 &&
      typeof group.longitud_x === 'number' &&
      Number.isFinite(group.longitud_x) &&
      typeof group.latitud_y === 'number' &&
      Number.isFinite(group.latitud_y)
  );

  if (locatedAddresses.length === 0) return null;

  const selectedAddressKey = selectedAddress ? getAddressGroupKey(selectedAddress) : null;
  const points: ChoroplethPoint[] = locatedAddresses.map((group) => {
    const isSelected = getAddressGroupKey(group) === selectedAddressKey;
    return {
      longitude: group.longitud_x as number,
      latitude: group.latitud_y as number,
      label: `${formatAddress(group)} (${group.apartments_count} habitatges, ${group.total_places} places)`,
      radius: isSelected ? 6 : 4,
      color: isSelected ? '#111827' : '#aa9465',
      ...(isSelected ? { stroke: '#111827' } : {}),
    };
  });
  const focusPoints = locatedAddresses.map(
    (group): [number, number] => [group.longitud_x as number, group.latitud_y as number]
  );

  return (
    <ChoroplethMap
      geoJsonUrl={STREET_MAP_GEOJSON}
      bcnAreas
      sourceCrs={EPSG_25831}
      filterProperty="TIPUS_UA"
      filterValue="BARRI"
      boundaryFilterValue="DISTRICTE"
      codeProperty="BARRI"
      labelProperty="NOM"
      data={[]}
      points={points}
      focusPoints={focusPoints}
      focusPointZoom={1.1}
      showAreaLabels={false}
      showBasemap
      showLegend={false}
      height={420}
    />
  );
}

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
  isSelected: boolean;
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
    columns.push({ type: 'bar', bar: { key: String(startNum), num: startNum, apartments: 0, places: 0, isSelected: false, district: '', neighborhood: '' } });
  }

  let prevNum: number | null = columns.length ? startNum : null;
  sorted.forEach((num) => {
    if (prevNum !== null && num - prevNum > MAX_NUMBER_GAP_BEFORE_ELLIPSIS) {
      columns.push({ type: 'ellipsis' });
    }
    columns.push({ type: 'bar', bar: { key: String(num), num, apartments: 0, places: 0, isSelected: false, district: '', neighborhood: '' } });
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
  selectedAddressLabel,
  invertY = false,
}: {
  title: string;
  titlePlacement?: 'top' | 'bottom';
  columns: DistributionColumn[];
  colorFor: (district: string, neighborhood: string) => string;
  maxValue: number;
  metric: DistributionMetric;
  selectedAddressLabel?: string;
  invertY?: boolean;
}) {
  const chartHeight = 110;
  // Ticks read top-to-bottom: max→0 normally, or 0→max when the axis is inverted.
  const yTicks = (invertY ? [0, 0.25, 0.5, 0.75, 1] : [1, 0.75, 0.5, 0.25, 0]).map((fraction) =>
    Math.round(maxValue * fraction)
  );

  const titleEl = <div className="text-sm text-gray-600 mb-1">{title}</div>;
  const selectedColumnIndex = columns.findIndex((column) => column.type === 'bar' && column.bar.isSelected);
  const selectedLabelOnRight = selectedColumnIndex < columns.length / 2;

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
                    bar.isSelected && selectedAddressLabel
                      ? `Adreça seleccionada: ${selectedAddressLabel}`
                      : bar.district
                        ? `Núm ${bar.key}: ${value} ${METRIC_LABELS[metric]} · ${bar.district} · ${bar.neighborhood}`
                        : `Núm ${bar.key}`
                  }
                  style={{
                    flex: `0 0 ${BAR_COLUMN_WIDTH}px`,
                    height: `${heightPct}%`,
                    background: bar.isSelected
                      ? '#111827'
                      : bar.district
                        ? colorFor(bar.district, bar.neighborhood)
                        : 'transparent',
                    borderRadius: invertY ? '0 0 2px 2px' : '2px 2px 0 0',
                    outline: bar.isSelected ? '2px solid #ffffff' : undefined,
                    outlineOffset: '-1px',
                    position: bar.isSelected ? 'relative' : undefined,
                    zIndex: bar.isSelected ? 4 : undefined,
                  }}
                >
                  {bar.isSelected && selectedAddressLabel && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 0,
                        ...(selectedLabelOnRight
                          ? { left: 'calc(100% + 6px)' }
                          : { right: 'calc(100% + 6px)' }),
                        zIndex: 5,
                        padding: '4px 8px',
                        color: '#ffffff',
                        background: '#111827',
                        borderRadius: 2,
                        fontSize: '0.75rem',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      {selectedAddressLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {titlePlacement === 'bottom' && titleEl}
    </div>
  );
}

export function AddressNumberDistributionChart({
  groups,
  streetName,
  selectedAddress,
}: {
  groups: AddressGroup[];
  streetName?: string;
  selectedAddress: AddressGroup | null;
}) {
  const [metric, setMetric] = useState<DistributionMetric>('apartments');
  const selectedAddressKey = selectedAddress ? getAddressGroupKey(selectedAddress) : null;
  const selectedAddressLabel = selectedAddress ? formatAddress(selectedAddress, streetName) : undefined;

  const bars: DistributionBar[] = groups
    .filter((group) => group.num1 !== undefined && group.num1 !== null)
    .map((group) => ({
      key: `${group.num1}${group.lletra1 || ''}`,
      num: group.num1 as number,
      apartments: group.apartments_count,
      places: group.total_places,
      isSelected: getAddressGroupKey(group) === selectedAddressKey,
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
    <div className="mb-3 p-4 border border-gray-200 bg-gray-50">
      <SelectedAddressAnnotation address={selectedAddress} streetName={streetName} />
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <h5 className="text-sm text-gray-600">Distribució dels habitatges d&apos;ús turístic al carrer {groups[0] ? formatStreetName(groups[0]) : ''}</h5>
        <div className="btn-group rounded-0" role="group" aria-label="Mètrica de la distribució">
          <button
            type="button"
            className={`btn rounded-0 ${metric === 'apartments' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setMetric('apartments')}
          >
            Apartaments
          </button>
          <button
            type="button"
            className={`btn rounded-0 ${metric === 'places' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setMetric('places')}
          >
            Places
          </button>
        </div>
      </div>
      {/* Single shared horizontal scrollbar for all three rows, so they always stay in sync and use the full available width before scrolling. */}
      <div style={{ overflowX: 'auto' }}>
        <DistributionChart title="Números senars" columns={oddColumns} colorFor={colorFor} maxValue={maxValue} metric={metric} selectedAddressLabel={selectedAddressLabel} />
        <NumberAxisLabels columns={sharedColumns} />
        <DistributionChart
          title="Números parells"
          titlePlacement="bottom"
          columns={evenColumns}
          colorFor={colorFor}
          maxValue={maxValue}
          metric={metric}
          selectedAddressLabel={selectedAddressLabel}
          invertY
        />
      </div>

      {/* Legend: district = master color swatch, neighbourhood swatches = gradient within that district */}
      <div className="mt-3 d-flex flex-column gap-2">
        {Array.from(neighborhoodsByDistrict.entries()).map(([district, neighborhoods]) => (
          <div key={district} className="d-flex align-items-center flex-wrap gap-2">
            <span
              className="d-inline-block rounded-sm"
              style={{ width: '10px', height: '10px', background: getDistrictColor(district), flexShrink: 0 }}
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

export const ApartmentResults = memo(function ApartmentResults({
  title,
  streetName,
  addressGroups,
  reference,
  loading,
  onResetSearch,
}: ApartmentResultsProps) {
  const displayGroups = useMemo(
    () => dedupeAddressGroups(addressGroups).sort(compareByStreetNumber),
    [addressGroups]
  );

  const selectedAddress = displayGroups[0] ?? null;

  if (loading) {
    return (
      <div className="container border border-white/40 bg-transparent p-4 backdrop-blur-sm">
        <p className="mt-2 text-gray-600">Cercant habitatges turístics...</p>
      </div>
    );
  }

  return (
    <section id="seccio-resultats" ref={reference} className='bg-transparent'>
      <div className="search-results-container container">
        {/* At the first place the result of the search */}
        <div className="search-results-header">
          {!displayGroups.length ? (
            <div className="alert alert-warning p-4 rounded-0 mb-0">
              <h4 className="alert-heading fw-normal">No s&apos;han trobat habitatges d&apos;us turistic en <strong>{title}</strong></h4>
              <p className="mb-0">Probablement el pis que busques és il·legal</p>
              <hr></hr>
              <div className="d-flex align-items-start gap-3">
                <button type="button" className="btn btn-outline-secondary rounded-0 ms-auto" onClick={onResetSearch}>
                  Esborrar cerca
                </button>
                <a href="https://atencioenlinia.ajuntament.barcelona.cat/ca/fitxa/alta?cbDetall=3205"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-secondary rounded-0">
                  Avisa&apos;ns
                </a>
              </div>
            </div>
          ) : (
            <div className="alert alert-info p-4 rounded-0" role="alert">
              <h4 className="alert-heading fw-normal">
                <strong>{selectedAddress ? formatAddress(selectedAddress) : 'Adreça no disponible'}</strong>
                {/* {totalDoors === 1 ? 's\'ha trobat' : 's\'han trobat'} <strong>{totalDoors}&nbsp;{totalDoors === 1 ? 'habitatge' : 'habitatges'}</strong>&nbsp;amb llicencia d&apos;ús turístic para un total de <strong>{group.total_places || 0}&nbsp;plaçes</strong>. */}
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
          )
          }
        </div>
        {/* At the first place the result of the search */}
        {displayGroups.length > 0 && (
          displayGroups.map((group, idx) => {
            return (
              <ApartmentDetail key={idx} group={group} streetName={streetName} onResetSearch={onResetSearch} />
            );
          })
        )}

      </div>
    </section>
  );
});
