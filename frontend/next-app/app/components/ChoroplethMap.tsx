'use client';

import { useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import { scaleSequential } from 'd3-scale';
import { interpolateBlues } from 'd3-scale-chromatic';
import { geoPath, geoMercator } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
    /** Radius in screen pixels, so dots keep their size while zooming. */
    radius?: number;
    color?: string;
    /** Draws the dot larger and pins its label next to it. */
    highlighted?: boolean;
}

/** Extra boundaries drawn underneath the choropleth, reprojected to share its projection. */
export interface ContextLayer {
    geoJsonUrl: string;
    /** proj4 definition of the file's CRS; omit when it is already WGS84 lon/lat. */
    sourceCrs?: string;
    stroke?: string;
    strokeWidth?: number;
    /** Property holding the area name, e.g. "nom_comarca"; enables the centred labels. */
    labelProperty?: string;
}

interface AreaLabel {
    name: string;
    x: number;
    y: number;
    code?: string;
}

export interface ChoroplethSelection {
    code: string | number;
    label: string;
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
    /** [longitude, latitude] pairs the view zooms to, taking priority over `focusCode`. */
    focusPoints?: [number, number][];
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
    /** Draws the `labelProperty` name centred on each outline area and context area. */
    showAreaLabels?: boolean;
    /** Zooms the viewport onto the area with this code. */
    focusCode?: string | number | null;
    /** Rendered at the top of the floating panel, above the legend. */
    controls?: ReactNode;
    /** Rendered in the nested panel that slides out of the floating panel; hidden when omitted. */
    detail?: ReactNode;
    showLegend?: boolean;
    onSelect?: (selection: ChoroplethSelection | null) => void;
}

const LABEL_LINE_HEIGHT = 1.05;

// Long names are split on spaces so they stay inside their shape.
function AreaLabelText({
    label,
    fontSize,
    fill,
    halo = '#ffffff',
}: {
    label: AreaLabel;
    fontSize: number;
    fill: string;
    halo?: string;
}) {
    const lines = label.name.toLocaleUpperCase('ca-ES').split(/\s+/).filter(Boolean);

    return (
        <text
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight={300}
            letterSpacing={fontSize * 0.06}
            fill={fill}
            stroke={halo}
            strokeWidth={fontSize / 14}
            strokeOpacity={0.6}
            paintOrder="stroke"
            style={{ pointerEvents: 'none' }}
        >
            {lines.map((line, idx) => (
                <tspan
                    key={line + idx}
                    x={label.x}
                    dy={idx === 0 ? `${(-(lines.length - 1) / 2) * LABEL_LINE_HEIGHT}em` : `${LABEL_LINE_HEIGHT}em`}
                >
                    {line}
                </tspan>
            ))}
        </text>
    );
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
    focusPoints = [],
    metricLabel = 'valor',
    height = 420,
    width = 800,
    filterProperty,
    filterValue,
    boundaryFilterValue,
    boundaryStrokeWidth = 2.5,
    contextLayer,
    showAreaLabels = true,
    focusCode,
    controls,
    detail,
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
    const [panelCollapsed, setPanelCollapsed] = useState(false);
    const [alignRight, setAlignRight] = useState(false);
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [basemapReady, setBasemapReady] = useState(false);
    const mapRef = useRef<HTMLDivElement | null>(null);
    const basemapRef = useRef<HTMLDivElement | null>(null);
    const basemapMapRef = useRef<LeafletMap | null>(null);

    const isZoomed = focusCode !== undefined && focusCode !== null;

    const numericHeight = typeof height === 'number' ? height : 420;

    // The floating panel covers the left side on desktop, so the map is pushed to the right there.
    useEffect(() => {
        const query = window.matchMedia('(min-width: 768px)');
        const update = () => setAlignRight(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    // The viewBox is built to match the rendered box, so its size has to be measured.
    useEffect(() => {
        const element = mapRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            const { width: boxWidth, height: boxHeight } = entry.contentRect;
            setViewport({ width: boxWidth, height: boxHeight });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

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

        // Zooming means framing a single feature instead of the whole layer; the projection itself never changes.
        const focus =
            focusCode === undefined || focusCode === null
                ? undefined
                : geoData.features.find((feature) => normalizeCode(feature.properties?.[codeProperty]) === normalizeCode(focusCode));

        // The focus points win the framing: they are the connected addresses the user just picked.
        const linePoints = focusPoints
            .map((point) => projection(point))
            .filter((point): point is [number, number] => Array.isArray(point));
        const lineBounds =
            linePoints.length > 1
                ? ([
                      [Math.min(...linePoints.map((p) => p[0])), Math.min(...linePoints.map((p) => p[1]))],
                      [Math.max(...linePoints.map((p) => p[0])), Math.max(...linePoints.map((p) => p[1]))],
                  ] as [[number, number], [number, number]])
                : null;

        const [[x0, y0], [x1, y1]] = lineBounds ?? path.bounds((focus ?? geoData) as Feature<Geometry>);
        const pad = lineBounds ? 16 : focus ? 8 : 4;
        // Keeps a short street from zooming past any useful context.
        const minExtent = lineBounds ? 60 : 0;
        const targetWidth = Math.max(x1 - x0 + pad * 2, minExtent);
        const targetHeight = Math.max(y1 - y0 + pad * 2, minExtent);
        const targetCenterX = (x0 + x1) / 2;
        const targetCenterY = (y0 + y1) / 2;

        // Matching the viewBox aspect to the rendered box removes the letterboxing and lets us place the map freely.
        const boxAspect = viewport.width > 0 && viewport.height > 0 ? viewport.width / viewport.height : targetWidth / targetHeight;
        const targetAspect = targetWidth / targetHeight;
        const viewBoxWidth = boxAspect >= targetAspect ? targetHeight * boxAspect : targetWidth;
        const viewBoxHeight = boxAspect >= targetAspect ? targetHeight : targetWidth / boxAspect;

        // Two thirds across normally, a bit right of centre while zoomed; clamped so nothing gets cropped.
        const desiredFraction = alignRight ? (focus || lineBounds ? 0.7 : 0.66) : 0.5;
        const centerFraction = Math.min(desiredFraction, 1 - targetWidth / 2 / viewBoxWidth);
        const viewBoxX = targetCenterX - centerFraction * viewBoxWidth;
        const viewBoxY = targetCenterY - viewBoxHeight / 2;

        return {
            path,
            projection,
            viewBox: `${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`,
            center: [viewBoxX + viewBoxWidth / 2, viewBoxY + viewBoxHeight / 2] as [number, number],
            unitsPerPixel: viewBoxWidth / (viewport.width || width),
        };
    }, [geoData, width, numericHeight, viewport, alignRight, focusCode, codeProperty, focusPoints]);

    const pathGenerator = projected?.path ?? null;
    // Strokes, labels and dots are sized in pixels and converted, so they stay constant while zooming.
    const unit = projected?.unitsPerPixel ?? 1;

    // Tiles are only worth loading once the view is zoomed into a single area.
    useEffect(() => {
        if (!isZoomed) return;
        let cancelled = false;

        import('leaflet').then((L) => {
            if (cancelled || !basemapRef.current || basemapMapRef.current) return;
            const map = L.map(basemapRef.current, {
                zoomControl: false,
                zoomSnap: 0,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                touchZoom: false,
                boxZoom: false,
                keyboard: false,
            }).setView([41.39, 2.17], 12);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            }).addTo(map);
            basemapMapRef.current = map;
            setBasemapReady(true);
        });

        return () => {
            cancelled = true;
            basemapMapRef.current?.remove();
            basemapMapRef.current = null;
            setBasemapReady(false);
        };
    }, [isZoomed]);

    // Leaflet and d3 share the spherical Mercator, so the SVG viewBox can be converted into a centre and a fractional zoom.
    useEffect(() => {
        const map = basemapMapRef.current;
        if (!map || !basemapReady || !projected) return;

        const center = projected.projection.invert?.(projected.center);
        if (!center) return;
        // d3 spans the world in 2*PI*scale units, Leaflet in 256*2^zoom pixels.
        const pixelScale = projected.projection.scale() / projected.unitsPerPixel;
        map.invalidateSize({ animate: false });
        map.setView([center[1], center[0]], Math.log2((2 * Math.PI * pixelScale) / 256), { animate: false });
    }, [basemapReady, projected, viewport]);

    // Names of the outline areas (districts): the boundary layer when one exists, otherwise the main layer itself.
    const areaLabels = useMemo<AreaLabel[]>(() => {
        const layer = boundaryData ?? geoData;
        if (!showAreaLabels || !pathGenerator || !labelProperty || !layer) return [];

        return layer.features.flatMap((feature) => {
            const name = feature.properties?.[labelProperty];
            if (!name) return [];
            const [x, y] = pathGenerator.centroid(feature as Feature<Geometry>);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
            return [{ name: String(name), x, y, code: normalizeCode(feature.properties?.[codeProperty]) }];
        });
    }, [showAreaLabels, pathGenerator, labelProperty, codeProperty, boundaryData, geoData]);

    // Names of the choropleth areas themselves (barris): only worth showing once zoomed into one of them.
    const zoomLabels = useMemo<AreaLabel[]>(() => {
        const isZoomed = focusCode !== undefined && focusCode !== null;
        if (!showAreaLabels || !isZoomed || !pathGenerator || !labelProperty || !boundaryData || !geoData) return [];

        return geoData.features.flatMap((feature) => {
            const name = feature.properties?.[labelProperty];
            if (!name) return [];
            const [x, y] = pathGenerator.centroid(feature as Feature<Geometry>);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
            return [{ name: String(name), x, y, code: normalizeCode(feature.properties?.[codeProperty]) }];
        });
    }, [showAreaLabels, focusCode, pathGenerator, labelProperty, codeProperty, boundaryData, geoData]);

    // Comarques arrive split into several polygons, so label only the largest one of each name.
    const contextLabels = useMemo<AreaLabel[]>(() => {
        const property = contextLayer?.labelProperty;
        if (!showAreaLabels || !pathGenerator || !property || !contextData) return [];

        const largest = new Map<string, AreaLabel & { area: number }>();
        contextData.features.forEach((feature) => {
            const name = feature.properties?.[property];
            if (!name) return;
            const typed = feature as Feature<Geometry>;
            const [x, y] = pathGenerator.centroid(typed);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const area = pathGenerator.area(typed);
            const current = largest.get(String(name));
            if (!current || area > current.area) largest.set(String(name), { name: String(name), x, y, area });
        });

        return Array.from(largest.values());
    }, [showAreaLabels, pathGenerator, contextLayer?.labelProperty, contextData]);

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
        <div className="container choropleth-wrapper d-flex flex-column gap-2 position-relative">
            {(controls || showLegend) && (
                <div className={`choropleth-panel${panelCollapsed ? ' choropleth-panel--collapsed' : ''}`}>
                    <button
                        type="button"
                        className="choropleth-panel__toggle"
                        aria-expanded={!panelCollapsed}
                        aria-label={panelCollapsed ? 'Mostra el panell' : 'Amaga el panell'}
                        onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
                    >
                        {panelCollapsed ? '\u203a' : '\u2039'}
                    </button>

                    <div className="choropleth-panel__body d-flex flex-column gap-3">
                        <h2>Barcelona</h2>
                        {summary && (
                            <dl className="choropleth-panel__summary mb-0">
                                {/* <dt>Total</dt> */}
                                <dd>
                                    <h2 className="fw-normal">{formatNumber(summary.total)} {metricLabel}</h2>
                                </dd>
                                {/* <dt>Mitjana</dt>
                                <dd>
                                    {formatNumber(summary.average)} {metricLabel}
                                </dd>
                                <dt>Amb dades</dt>
                                <dd>
                                    {summary.areasWithData}/{summary.areasTotal}
                                </dd>
                                {summary.top.label && (
                                    <>
                                        <dt>Màxim</dt>
                                        <dd>
                                            {summary.top.label} ({formatNumber(summary.top.value)})
                                        </dd>
                                    </>
                                )} */}
                            </dl>
                        )}
                        {controls}
                    </div>

                    {detail && <div className="choropleth-detail">{detail}</div>}
                </div>
            )
            }

            <div ref={mapRef} className="overflow-hidden position-relative bg-light" style={{ height }}>
                {isZoomed && <div ref={basemapRef} className="choropleth-basemap" />}
                {geoData && pathGenerator ? (
                    <svg viewBox={projected?.viewBox} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
                        {contextData &&
                            contextData.features.map((feature, idx) => (
                                <path
                                    key={`context-${idx}`}
                                    d={pathGenerator(feature as Feature<Geometry>) ?? undefined}
                                    fill={isZoomed ? 'none' : '#FFF'}
                                    stroke={contextLayer?.stroke ?? '#94a3b8'}
                                    strokeWidth={2 * unit}
                                    strokeOpacity={0.4}
                                    style={{ pointerEvents: 'none' }}
                                />
                            ))}
                        {/* Drawn before the choropleth so comarca names only show on the areas around the city. */}
                        {contextLabels.map((label) => (
                            <AreaLabelText key={`context-label-${label.name}`} label={label} fontSize={15 * unit} fill="#64748b" />
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
                            const isFocused = isZoomed && focusCode !== undefined && focusCode !== null && code === normalizeCode(focusCode);

                            return (
                                <path
                                    key={idx}
                                    d={pathGenerator(feature as Feature<Geometry>) ?? undefined}
                                    fill={datum ? colorScale(datum.value) : '#e5e7eb'}
                                    fillOpacity={isFocused ? 0 : isZoomed ? 0.45 : 0.85}
                                    stroke={isFocused || isHovered ? '#111827' : '#4b5563'}
                                    strokeWidth={(isFocused ? 4 : isHovered ? 2 : 1) * unit}
                                    strokeOpacity={isFocused ? 0.9 : isHovered ? 0.6 : 0.25}
                                    onMouseEnter={(e) => {
                                        setHoveredCode(code);
                                        setTooltip({ x: e.clientX, y: e.clientY, text: `${label}: ${value} ${metricLabel}` });
                                    }}
                                    onMouseMove={(e) => setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
                                    onMouseLeave={() => {
                                        setHoveredCode(null);
                                        setTooltip(null);
                                    }}
                                    onClick={() => onSelect?.({ code: datum?.code ?? feature.properties?.[codeProperty], label: String(label) })}
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
                                    strokeWidth={boundaryStrokeWidth * unit}
                                    strokeOpacity={0.4}
                                    style={{ pointerEvents: 'none' }}
                                />
                            ))}
                        {points.map((point, idx) => {
                            const projectedPoint = projected?.projection([point.longitude, point.latitude]);
                            if (!projectedPoint) return null;
                            const radius = (point.highlighted ? (point.radius ?? 5) * 2 : point.radius ?? 5) * unit;
                            return (
                                <g key={`result-point-${idx}`}>
                                    <circle
                                        cx={projectedPoint[0]}
                                        cy={projectedPoint[1]}
                                        r={radius}
                                        fill={point.color ?? '#dc2626'}
                                        onMouseEnter={(e) => point.label && setTooltip({ x: e.clientX, y: e.clientY, text: point.label })}
                                        onMouseMove={(e) => setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
                                        onMouseLeave={() => setTooltip(null)}
                                    />
                                    {point.highlighted && point.label && (
                                        <text
                                            x={projectedPoint[0]}
                                            y={projectedPoint[1] - radius - 4 * unit}
                                            textAnchor="middle"
                                            fontSize={12 * unit}
                                            fontWeight={500}
                                            fill="#7f1d1d"
                                            stroke="#ffffff"
                                            strokeWidth={3 * unit}
                                            strokeOpacity={0.8}
                                            paintOrder="stroke"
                                            style={{ pointerEvents: 'none' }}
                                        >
                                            {point.label}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                        {zoomLabels.map((label) => (
                            <AreaLabelText key={`zoom-label-${label.name}`} label={label} fontSize={11 * unit} fill="#334155" />
                        ))}
                        {areaLabels.map((label) => {
                            // The darkest end of the scale needs a light label to stay readable.
                            const value = label.code ? valueByCode.get(label.code)?.value ?? 0 : 0;
                            const onDarkFill = maxValue > 0 && value / maxValue >= 0.7;
                            return (
                                <AreaLabelText
                                    key={`area-label-${label.name}`}
                                    label={label}
                                    fontSize={13 * unit}
                                    fill={onDarkFill ? '#ffffff' : '#1f2937'}
                                    halo={onDarkFill ? '#0f172a' : '#ffffff'}
                                />
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

            {
                showLegend && !isZoomed && (
                    <div className="choropleth-legend d-flex flex-column gap-1">
                        <svg width="100%" height={12} preserveAspectRatio="none" aria-hidden>
                            <defs>
                                <linearGradient id="choropleth-legend-gradient" x1="0" x2="1" y1="0" y2="0">
                                    {[0, 0.25, 0.5, 0.75, 1].map((stop) => (
                                        <stop key={stop} offset={`${stop * 100}%`} stopColor={colorScale(stop * (maxValue || 1))} />
                                    ))}
                                </linearGradient>
                            </defs>
                            <rect width="100%" height={12} fill="url(#choropleth-legend-gradient)" />
                        </svg>
                        <div className="choropleth-legend__scale">
                            {[0, 0.25, 0.5, 0.75, 1].map((stop) => (
                                <span key={stop} className="choropleth-legend__tick">
                                    {formatNumber(stop * maxValue)}
                                </span>
                            ))}
                        </div>
                        <span className="choropleth-panel__meta">{metricLabel}</span>
                    </div>
                )
            }
        </div >
    );
}
