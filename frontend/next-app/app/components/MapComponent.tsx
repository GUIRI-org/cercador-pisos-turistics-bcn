'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChoroplethMap, ChoroplethDatum, ChoroplethPoint, ChoroplethSelection, ContextLayer } from './ChoroplethMap';
import { SAMPLE_DISTRICT_DATA, SAMPLE_NEIGHBOURHOOD_DATA } from '../data/sampleChoroplethData';
import { EPSG_25831 } from '../lib/geoUtils';
import { fetchApartmentMap, fetchDistrictStats, fetchNeighborhoodStats } from '@/lib/api';
import type { AddressGroup } from '@/lib/types';

type ChoroplethLevel = 'district' | 'neighbourhood';
type ChoroplethMetric = 'apartments' | 'addresses' | 'places';

interface MapComponentProps {
  data?: ChoroplethDatum[];
  points?: ChoroplethPoint[];
  height?: number | string;
  defaultLevel?: ChoroplethLevel;
  defaultMetric?: ChoroplethMetric;
}

// One official GeoJSON holds every administrative level (TERME/DISTRICTE/BARRI/AEB) —
// pick the level via the TIPUS_UA property instead of swapping between separate files.
const GEOJSON_URL = '/geo/barcelona-barris.geojson';
// Comarca boundaries around Barcelona, already lon/lat. Drawn as context only — the main
// layer above still drives fitSize, so the viewport stays zoomed on Barcelona city.
const COMARQUES_CONTEXT: ContextLayer = {
  geoJsonUrl: '/geo/dts_comarques_8comarques.geojson',
  stroke: '#94a3b8',
  strokeWidth: 1.5,
  labelProperty: 'nom_comarca',
};

interface LevelConfig {
  geoJsonUrl: string;
  sourceCrs?: string;
  codeProperty: string;
  labelProperty?: string;
  filterProperty?: string;
  filterValue?: string;
  boundaryFilterValue?: string;
  contextLayer?: ContextLayer;
  sampleData: ChoroplethDatum[];
}

const LEVEL_CONFIG: Record<ChoroplethLevel, LevelConfig> = {
  district: {
    geoJsonUrl: GEOJSON_URL,
    sourceCrs: EPSG_25831,
    codeProperty: 'DISTRICTE',
    labelProperty: 'NOM',
    filterProperty: 'TIPUS_UA',
    filterValue: 'DISTRICTE',
    contextLayer: COMARQUES_CONTEXT,
    sampleData: SAMPLE_DISTRICT_DATA,
  },
  neighbourhood: {
    geoJsonUrl: GEOJSON_URL,
    sourceCrs: EPSG_25831,
    codeProperty: 'BARRI',
    labelProperty: 'NOM',
    filterProperty: 'TIPUS_UA',
    filterValue: 'BARRI',
    boundaryFilterValue: 'DISTRICTE',
    contextLayer: COMARQUES_CONTEXT,
    sampleData: SAMPLE_NEIGHBOURHOOD_DATA,
  },
};

const LEVEL_OPTIONS: { value: ChoroplethLevel; label: string }[] = [
  { value: 'district', label: 'Districtes' },
  { value: 'neighbourhood', label: 'Barris' },
];

const METRIC_OPTIONS: { value: ChoroplethMetric; label: string; unit: string }[] = [
  { value: 'apartments', label: 'Habitatges', unit: 'habitatges' },
  { value: 'addresses', label: 'Adreces', unit: 'adreces' },
  { value: 'places', label: 'Places', unit: 'places' },
];

interface AreaStat {
  code: number;
  label: string;
  apartments: number;
  places: number;
}

// Counts one entry per street+number, which is what the address metric aggregates.
const countAddressesByArea = (groups: AddressGroup[], level: ChoroplethLevel): ChoroplethDatum[] => {
  const counts = new Map<number, { value: number; label?: string }>();

  groups.forEach((group) => {
    const code = level === 'district' ? group.codi_districte : group.codi_barri;
    if (code === undefined || code === null) return;
    const label = level === 'district' ? group.nom_districte : group.nom_barri;
    const entry = counts.get(code) ?? { value: 0, label };
    entry.value += 1;
    entry.label = entry.label ?? label;
    counts.set(code, entry);
  });

  return Array.from(counts, ([code, entry]) => ({ code, value: entry.value, label: entry.label }));
};

const formatNumber = (value: number) => new Intl.NumberFormat('ca-ES').format(value);

// Codes like "01" in the GeoJSON must match the plain numeric codes coming from the API.
const sameCode = (a: string | number | undefined | null, b: string | number | undefined | null) => {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  return Number(a) === Number(b);
};

export function MapComponent({
  data,
  points = [],
  height = 480,
  defaultLevel = 'neighbourhood',
  defaultMetric = 'apartments',
}: MapComponentProps) {
  const [level, setLevel] = useState<ChoroplethLevel>(defaultLevel);
  const [metric, setMetric] = useState<ChoroplethMetric>(defaultMetric);
  const [stats, setStats] = useState<{ level: ChoroplethLevel; rows: AreaStat[] } | null>(null);
  const [addressGroups, setAddressGroups] = useState<AddressGroup[] | null>(null);
  const [selection, setSelection] = useState<ChoroplethSelection | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<AddressGroup | null>(null);

  const config = LEVEL_CONFIG[level];
  const metricUnit = METRIC_OPTIONS.find((option) => option.value === metric)?.unit ?? '';

  useEffect(() => {
    let cancelled = false;

    // codi_districte/codi_barri from the API are matched against DISTRICTE/BARRI in the GeoJSON.
    const load = level === 'district'
      ? fetchDistrictStats().then((rows) =>
          rows.map((row): AreaStat => ({
            code: row.codi_districte,
            label: row.nom_districte,
            apartments: row.apartments_count,
            places: row.total_places,
          }))
        )
      : fetchNeighborhoodStats().then((rows) =>
          rows.map((row): AreaStat => ({
            code: row.codi_barri,
            label: row.nom_barri,
            apartments: row.apartments_count,
            places: row.total_places,
          }))
        );

    load.then((rows) => {
      if (!cancelled) setStats({ level, rows });
    });

    return () => {
      cancelled = true;
    };
  }, [level]);

  useEffect(() => {
    if ((metric !== 'addresses' && !selection) || addressGroups) return;
    let cancelled = false;

    fetchApartmentMap().then((groups) => {
      if (!cancelled) setAddressGroups(groups);
    });

    return () => {
      cancelled = true;
    };
  }, [metric, selection, addressGroups]);

  // Switching the division invalidates the selected code, so close the detail panel.
  useEffect(() => {
    setSelection(null);
    setSelectedAddress(null);
  }, [level]);

  const selectedAddresses = useMemo(() => {
    if (!selection || !addressGroups) return null;
    return addressGroups
      .filter((group) => sameCode(level === 'district' ? group.codi_districte : group.codi_barri, selection.code))
      .sort((a, b) => b.apartments_count - a.apartments_count || b.total_places - a.total_places);
  }, [selection, addressGroups, level]);

  useEffect(() => {
    setSelectedAddress(null);
  }, [selection]);

  const resolvedData = useMemo(() => {
    if (data) return data;

    if (metric === 'addresses') {
      return addressGroups ? countAddressesByArea(addressGroups, level) : [];
    }

    const rows = stats?.level === level ? stats.rows : null;
    if (!rows || rows.length === 0) return metric === 'apartments' ? config.sampleData : [];

    return rows.map((row): ChoroplethDatum => ({
      code: row.code,
      value: metric === 'places' ? row.places : row.apartments,
      label: row.label,
    }));
  }, [data, metric, addressGroups, level, stats, config.sampleData]);

  const selectedApartments = useMemo(() => {    if (!selectedAddress) return [];
    return [...selectedAddress.apartments].sort(
      (a, b) =>
        (a.pis ?? '').localeCompare(b.pis ?? '', 'ca', { numeric: true }) ||
        (a.porta ?? '').localeCompare(b.porta ?? '', 'ca', { numeric: true })
    );
  }, [selectedAddress]);

  // Small dots for every street+number of the selected area, on top of the search result markers.
  const mapPoints = useMemo(() => {
    const addressPoints = (selectedAddresses ?? []).flatMap((group): ChoroplethPoint[] => {
      if (group.longitud_x === undefined || group.latitud_y === undefined) return [];
      const highlighted = group === selectedAddress;
      return [
        {
          longitude: group.longitud_x,
          latitude: group.latitud_y,
          label: highlighted ? group.address : `${group.address} (${formatNumber(group.apartments_count)} habitatges)`,
          radius: 2.5,
          color: highlighted ? '#dc2626' : '#1e293b',
          highlighted,
        },
      ];
    });
    // The highlighted dot goes last so it is drawn on top of its neighbours.
    return [
      ...addressPoints.filter((point) => !point.highlighted),
      ...addressPoints.filter((point) => point.highlighted),
      ...points,
    ];
  }, [selectedAddresses, selectedAddress, points]);

  const controls = (
    <div className="d-flex flex-column gap-2">
      <div>
        <span className="choropleth-panel__label">Divisió</span>
        <div className="btn-group btn-group-sm w-100" role="group" aria-label="Divisió territorial">
          {LEVEL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`btn ${level === option.value ? 'btn-primary' : 'btn-outline-primary'}`}
              aria-pressed={level === option.value}
              onClick={() => setLevel(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="choropleth-panel__label" htmlFor="choropleth-metric">
          Suma per
        </label>
        <select
          id="choropleth-metric"
          className="form-select form-select-sm"
          value={metric}
          onChange={(event) => setMetric(event.target.value as ChoroplethMetric)}
        >
          {METRIC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const detail = selection ? (
    <>
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div>
          <span className="choropleth-panel__label">Adreces</span>
          <strong>{selection.label}</strong>
        </div>
        <button
          type="button"
          className="btn-close"
          aria-label="Tanca el detall"
          onClick={() => {
            setSelection(null);
            setSelectedAddress(null);
          }}
        />
      </div>
      {selectedAddresses === null ? (
        <span className="choropleth-panel__meta">Carregant adreces&hellip;</span>
      ) : selectedAddresses.length === 0 ? (
        <span className="choropleth-panel__meta">Sense adreces registrades</span>
      ) : (
        <>
          <span className="choropleth-panel__meta">{formatNumber(selectedAddresses.length)} adreces</span>
          <ol className="choropleth-detail__list">
            {selectedAddresses.map((group, idx) => (
              <li key={`${group.address}-${idx}`}>
                <button
                  type="button"
                  className="choropleth-detail__item"
                  aria-pressed={selectedAddress === group}
                  onClick={() => setSelectedAddress(group)}
                >
                  <span className="choropleth-detail__address">{group.address}</span>
                  <span className="choropleth-panel__meta">
                    {formatNumber(group.apartments_count)} habitatges &middot; {formatNumber(group.total_places)} places
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}

      {selectedAddress && (
        <div className="choropleth-subdetail">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div>
              <span className="choropleth-panel__label">Distribució</span>
              <strong>{selectedAddress.address}</strong>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Tanca la distribució"
              onClick={() => setSelectedAddress(null)}
            />
          </div>
          <span className="choropleth-panel__meta">
            {formatNumber(selectedAddress.apartments_count)} habitatges &middot; {formatNumber(selectedAddress.total_places)} places
          </span>
          <ul className="choropleth-detail__list">
            {selectedApartments.map((apartment, idx) => (
              <li key={`${apartment.expedient}-${idx}`}>
                <span className="choropleth-detail__address">
                  Pis {apartment.pis || '—'} &middot; Porta {apartment.porta || '—'}
                </span>
                <span className="choropleth-panel__meta">
                  {apartment.num_places !== undefined ? `${formatNumber(apartment.num_places)} places` : 'Places desconegudes'}
                  {apartment.escala ? ` · Escala ${apartment.escala}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  ) : null;

  return (
    <ChoroplethMap
      geoJsonUrl={config.geoJsonUrl}
      sourceCrs={config.sourceCrs}
      filterProperty={config.filterProperty}
      filterValue={config.filterValue}
      boundaryFilterValue={config.boundaryFilterValue}
      contextLayer={config.contextLayer}
      codeProperty={config.codeProperty}
      labelProperty={config.labelProperty}
      data={resolvedData}
      points={mapPoints}
      focusCode={selection?.code ?? null}
      metricLabel={metricUnit}
      height={height}
      controls={controls}
      detail={detail}
      onSelect={setSelection}
    />
  );
}
