'use client';

import { useEffect, useState } from 'react';
import { ChoroplethMap, ChoroplethDatum, ChoroplethPoint, ContextLayer } from './ChoroplethMap';
import { SAMPLE_DISTRICT_DATA, SAMPLE_NEIGHBOURHOOD_DATA } from '../data/sampleChoroplethData';
import { EPSG_25831 } from '../lib/geoUtils';
import { fetchDistrictStats, fetchNeighborhoodStats } from '@/lib/api';

type ChoroplethLevel = 'district' | 'neighbourhood';

interface MapComponentProps {
  data?: ChoroplethDatum[];
  points?: ChoroplethPoint[];
  height?: number | string;
  level?: ChoroplethLevel;
}

// One official GeoJSON holds every administrative level (TERME/DISTRICTE/BARRI/AEB) —
// pick the level via the TIPUS_UA property instead of swapping between separate files.
const GEOJSON_URL = '/geo/barcelona-barris.geojson';
// Comarca boundaries around Barcelona, already lon/lat. Drawn as context only — the main
// layer above still drives fitSize, so the viewport stays zoomed on Barcelona city.
const COMARQUES_CONTEXT: ContextLayer = { geoJsonUrl: '/geo/dts_comarques_8comarques.geojson', stroke: '#94a3b8', strokeWidth: 1.5 };

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

export function MapComponent({ data, points = [], height = 480, level = 'neighbourhood' }: MapComponentProps) {
  const config = LEVEL_CONFIG[level];
  const [stats, setStats] = useState<{ level: ChoroplethLevel; data: ChoroplethDatum[] } | null>(null);

  useEffect(() => {
    let cancelled = false;

    // codi_districte/codi_barri from the API are matched against DISTRICTE/BARRI in the GeoJSON.
    const load = level === 'district'
      ? fetchDistrictStats().then((rows) =>
          rows.map((row): ChoroplethDatum => ({
            code: row.codi_districte,
            value: row.apartments_count,
            label: row.nom_districte,
          }))
        )
      : fetchNeighborhoodStats().then((rows) =>
          rows.map((row): ChoroplethDatum => ({
            code: row.codi_barri,
            value: row.apartments_count,
            label: row.nom_barri,
          }))
        );

    load.then((mapped) => {
      if (!cancelled) setStats({ level, data: mapped });
    });

    return () => {
      cancelled = true;
    };
  }, [level]);

  const apiData = stats?.level === level ? stats.data : null;
  const resolvedData = data ?? (apiData && apiData.length > 0 ? apiData : config.sampleData);

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
      points={points}
      metricLabel="habitatges"
      height={height}
    />
  );
}
