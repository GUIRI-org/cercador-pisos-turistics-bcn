'use client';

import { useMemo, useState, useEffect } from 'react';
import { scaleSequential } from 'd3-scale';
import { interpolateBlues } from 'd3-scale-chromatic';
import { geoPath, geoMercator } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { filterFeaturesByProperty, prepareLayer, summarizeFeaturesByProperty, toFeatureCollection } from '../lib/geoUtils';

export interface ChoroplethDatum {
  code: string | number;
  value: number;
  label?: string;
}

export interface ChoroplethPoint {
  longitude: number;
  latitude: number;
  label?: string;
}

/** Extra boundaries drawn underneath the choropleth, reprojected to share its projection. */
export interface ContextLayer {
  geoJsonUrl: string;
  /** proj4 definition of the file's CRS; omit when it is already WGS84 lon/lat. */
  sourceCrs?: string;
  stroke?: string;
  strokeWidth?: number;
}

interface ChoroplethMapProps {
  /** Path to a GeoJSON FeatureCollection with one polygon per area (served from /public). */
  geoJsonUrl: string;
  /** proj4 definition of `geoJsonUrl`'s CRS; omit when it is already WGS84 lon/lat. */
  sourceCrs?: string;
  /** Property in each feature's `properties` that matches `ChoroplethDatum.code`. */
  codeProperty: string;
  /** Property used for tooltips when an area has no datum, e.g. "nom_comarca". */
  labelProperty?: string;
  data: ChoroplethDatum[];
  points?: ChoroplethPoint[];
  /** Unit shown in tooltips, e.g. "apartaments". */
  metricLabel?: string;
  height?: number | string;
  /** Internal SVG viewport width used to fit the GeoJSON extent. */
  width?: number;
  /** Property used to pick a single administrative level out of a file that mixes several (e.g. TIPUS_UA). */
  filterProperty?: string;
  /** Value of `filterProperty` to keep, e.g. "DISTRICTE" or "BARRI". */
  filterValue?: string;
  /** Value of `filterProperty` to draw as a thicker, unfilled outline on top (e.g. "DISTRICTE" while showing barris). */
  boundaryFilterValue?: string;
  boundaryStrokeWidth?: number;
  contextLayer?: ContextLayer;
  showLegend?: boolean;
  onSelect?: (code: string | number | null) => void;
}

// Codes like "01" in official shapefiles must match plain sample codes like "1".
const normalizeCode = (value: unknown) => {
  const str = String(value ?? '').trim().toLowerCase();
  return /^\d+$/.test(str) ? String(parseInt(str, 10)) : str;
};

const formatNumber = (value: number) => new Intl.NumberFormat('ca-ES').format(Math.round(value));

export function ChoroplethMap({
  geoJsonUrl,
  sourceCrs,
  codeProperty,
  labelProperty,
  data,
  points = [],
  metricLabel = 'valor',
  height = 420,
  width = 800,
  filterProperty,
  filterValue,
  boundaryFilterValue,
  boundaryStrokeWidth = 2.5,
  contextLayer,
  showLegend = true,
  onSelect,
}: ChoroplethMapProps) {
  const [fetched, setFetched] = useState<{ url: string; data: FeatureCollection<Geometry> | null; error: boolean }>({
    url: '',
    data: null,
    error: false,
  });
  const [fetchedContext, setFetchedContext] = useState<{ url: string; data: FeatureCollection<Geometry> | null }>({
    url: '',
    data: null,
  });
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const numericHeight = typeof height === 'number' ? height : 420;

  useEffect(() => {
    let cancelled = false;

    fetch(geoJsonUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((raw: unknown) => {
        if (cancelled) return;
        const json = toFeatureCollection(raw);
        if (filterProperty) {
          // Surfaces the administrative levels present in the file (e.g. DISTRICTE/BARRI/AEB) to help pick filterValue.
          console.debug(`[ChoroplethMap] "${filterProperty}" groups in ${geoJsonUrl}:`, summarizeFeaturesByProperty(json, filterProperty));
        }
        setFetched({ url: geoJsonUrl, data: json, error: false });
      })
      .catch(() => {
        if (!cancelled) setFetched({ url: geoJsonUrl, data: null, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [geoJsonUrl, filterProperty]);

  const contextUrl = contextLayer?.geoJsonUrl;
  const contextCrs = contextLayer?.sourceCrs;

  useEffect(() => {
    let cancelled = false;
    if (!contextUrl) return;

    fetch(contextUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((raw: unknown) => {
        if (cancelled) return;
        const decoded = toFeatureCollection(raw);
        setFetchedContext({ url: contextUrl, data: prepareLayer(decoded, contextCrs) });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [contextUrl, contextCrs]);

  // Ignore results belonging to a previous URL instead of clearing state inside the effect.
  const rawGeoData = fetched.url === geoJsonUrl ? fetched.data : null;
  const loadError = fetched.url === geoJsonUrl && fetched.error;
  const contextData = contextUrl && fetchedContext.url === contextUrl ? fetchedContext.data : null;

  // Main choropleth polygons (e.g. the 73 barris), reprojected after filtering to avoid converting the whole file.
  const geoData = useMemo(() => {
    if (!rawGeoData) return null;
    const filtered = filterProperty && filterValue ? filterFeaturesByProperty(rawGeoData, filterProperty, filterValue) : rawGeoData;
    return prepareLayer(filtered, sourceCrs);
  }, [rawGeoData, filterProperty, filterValue, sourceCrs]);

  // Optional thicker outline layer grouping the polygons above (e.g. the 10 districts over the barris).
  const boundaryData = useMemo(() => {
    if (!rawGeoData || !filterProperty || !boundaryFilterValue) return null;
    const filtered = filterFeaturesByProperty(rawGeoData, filterProperty, boundaryFilterValue);
    return prepareLayer(filtered, sourceCrs);
  }, [rawGeoData, filterProperty, boundaryFilterValue, sourceCrs]);

  const valueByCode = useMemo(() => {
    const map = new Map<string, ChoroplethDatum>();
    data.forEach((d) => map.set(normalizeCode(d.code), d));
    return map;
  }, [data]);

  const maxValue = useMemo(() => data.reduce((max, d) => Math.max(max, d.value), 0), [data]);
  const colorScale = useMemo(() => scaleSequential(interpolateBlues).domain([0, maxValue || 1]), [maxValue]);

  // All layers are WGS84 by this point, so one Mercator projection fitted to the main layer serves them all.
  const projected = useMemo(() => {
    if (!geoData || geoData.features.length === 0) return null;
    const projection = geoMercator().fitSize([width, numericHeight], geoData);
    const path = geoPath(projection);
    // Cropping the viewBox to the drawn extent removes the dead margins left by fitting a non-matching aspect ratio.
    const [[x0, y0], [x1, y1]] = path.bounds(geoData);
    const pad = 4;
    return { path, projection, viewBox: `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}` };
  }, [geoData, width, numericHeight]);

  const pathGenerator = projected?.path ?? null;

  // Distribution summary over the areas currently matched with data.
  const summary = useMemo(() => {
    if (!geoData) return null;
    const matched = geoData.features
      .map((feature) => valueByCode.get(normalizeCode(feature.properties?.[codeProperty])))
      .filter((d): d is ChoroplethDatum => Boolean(d));
    if (matched.length === 0) return null;
    const total = matched.reduce((sum, d) => sum + d.value, 0);
    const top = matched.reduce((best, d) => (d.value > best.value ? d : best), matched[0]);
    return {
      total,
      areasWithData: matched.length,
      areasTotal: geoData.features.length,
      average: total / matched.length,
      top,
    };
  }, [geoData, valueByCode, codeProperty]);

  return (
    <div className="d-flex flex-column gap-2">
      <div className="overflow-hidden position-relative bg-info" style={{ height }}>
        {geoData && pathGenerator ? (
          <svg viewBox={projected?.viewBox} style={{ width: '100%', height: '100%' }}>
            {contextData &&
              contextData.features.map((feature, idx) => (
                <path
                  key={`context-${idx}`}
                  d={pathGenerator(feature as Feature<Geometry>) ?? undefined}
                  fill="#FFF"
                  stroke={contextLayer?.stroke ?? '#94a3b8'}
                  strokeWidth={2.5}
                  style={{ pointerEvents: 'none' }}
                />
              ))}
            {geoData.features.map((feature, idx) => {
              const code = normalizeCode(feature.properties?.[codeProperty]);
              const datum = valueByCode.get(code);
              const label =
                datum?.label ||
                (labelProperty ? feature.properties?.[labelProperty] : undefined) ||
                feature.properties?.[codeProperty] ||
                'Sense dades';
              const value = datum?.value ?? 0;
              const isHovered = hoveredCode === code;

              return (
                <path
                  key={idx}
                  d={pathGenerator(feature as Feature<Geometry>) ?? undefined}
                  fill={datum ? colorScale(datum.value) : '#e5e7eb'}
                  fillOpacity={0.85}
                  stroke={isHovered ? '#111827' : '#4b5563'}
                  strokeWidth={isHovered ? 2 : 1}
                  onMouseEnter={(e) => {
                    setHoveredCode(code);
                    setTooltip({ x: e.clientX, y: e.clientY, text: `${label}: ${value} ${metricLabel}` });
                  }}
                  onMouseMove={(e) => setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
                  onMouseLeave={() => {
                    setHoveredCode(null);
                    setTooltip(null);
                  }}
                  onClick={() => onSelect?.(datum?.code ?? null)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}
            {boundaryData &&
              boundaryData.features.map((feature, idx) => (
                <path
                  key={`boundary-${idx}`}
                  d={pathGenerator(feature as Feature<Geometry>) ?? undefined}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth={boundaryStrokeWidth}
                  style={{ pointerEvents: 'none' }}
                />
              ))}
            {points.map((point, idx) => {
              const projectedPoint = projected?.projection([point.longitude, point.latitude]);
              if (!projectedPoint) return null;
              return (
                <circle
                  key={`result-point-${idx}`}
                  cx={projectedPoint[0]}
                  cy={projectedPoint[1]}
                  r={5}
                  fill="#dc2626"
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {point.label && <title>{point.label}</title>}
                </circle>
              );
            })}
          </svg>
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 text-gray-500" style={{ fontSize: '0.9rem' }}>
            {loadError ? 'No s\u2019ha pogut carregar el mapa' : 'Carregant mapa...'}
          </div>
        )}
        {tooltip && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x + 12,
              top: tooltip.y + 12,
              background: '#111827',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              pointerEvents: 'none',
              zIndex: 1000,
              whiteSpace: 'nowrap',
            }}
          >
            {tooltip.text}
          </div>
        )}
        {loadError && (
          <p className="text-sm text-gray-600 mt-2 px-2">
            No s&apos;ha pogut carregar el fitxer GeoJSON ({geoJsonUrl}). Afegeix-lo a <code>public/geo</code>.
          </p>
        )}
      </div>

      {showLegend && (
        <div className="container py-5 d-flex flex-wrap align-items-center justify-content-between gap-3 px-1">
          <div className="d-flex align-items-center gap-2">
            <svg width={160} height={14} aria-hidden>
              <defs>
                <linearGradient id="choropleth-legend-gradient" x1="0" x2="1" y1="0" y2="0">
                  {[0, 0.25, 0.5, 0.75, 1].map((stop) => (
                    <stop key={stop} offset={`${stop * 100}%`} stopColor={colorScale(stop * (maxValue || 1))} />
                  ))}
                </linearGradient>
              </defs>
              <rect width={160} height={14} rx={3} fill="url(#choropleth-legend-gradient)" />
            </svg>
            <span className="text-sm text-gray-600">
              0 &rarr; {formatNumber(maxValue)} {metricLabel}
            </span>
          </div>
          {summary && (
            <div className="d-flex flex-wrap gap-3 text-sm text-gray-600">
              <span>
                Total: <strong>{formatNumber(summary.total)}</strong> {metricLabel}
              </span>
              <span>
                Mitjana: <strong>{formatNumber(summary.average)}</strong> {metricLabel}
              </span>
              <span>
                Amb dades: <strong>{summary.areasWithData}</strong>/{summary.areasTotal}
              </span>
              {summary.top.label && (
                <span>
                  Màxim: <strong>{summary.top.label}</strong> ({formatNumber(summary.top.value)})
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
