'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronRight, FaRegBuilding } from 'react-icons/fa6';
import { ChoroplethMap, ChoroplethDatum, ChoroplethPoint, ChoroplethSelection, ContextLayer } from './ChoroplethMap';
import { ApartmentDetail } from './StreetDetail';
import { SAMPLE_DISTRICT_DATA, SAMPLE_NEIGHBOURHOOD_DATA } from '../data/sampleChoroplethData';
import { EPSG_25831 } from '../lib/geoUtils';
import { getDistrictColor } from '../lib/districtColors';
import { fetchApartmentMap, fetchDistrictStats, fetchNeighborhoodStats } from '@/lib/api';
import type { AddressGroup } from '@/lib/types';

type ChoroplethLevel = 'district' | 'neighbourhood';

interface MapComponentProps {
    data?: ChoroplethDatum[];
    points?: ChoroplethPoint[];
    height?: number | string;
    defaultLevel?: ChoroplethLevel;
    /** Address coming from the search, used to open the area and address panels. */
    focusAddress?: AddressGroup | null;
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

const METRIC_UNIT = 'habitatges';

interface AreaStat {
    code: number;
    label: string;
    apartments: number;
    places: number;
}

// Counts one entry per street+number, which is what the address metric aggregates.
const formatNumber = (value: number) => new Intl.NumberFormat('ca-ES').format(value);

// Codes like "01" in the GeoJSON must match the plain numeric codes coming from the API.
const sameCode = (a: string | number | undefined | null, b: string | number | undefined | null) => {
    if (a === undefined || a === null || b === undefined || b === null) return false;
    return Number(a) === Number(b);
};

const streetKey = (group?: AddressGroup | null) => {
    const key = `${group?.tipus_carrer ?? ''} ${group?.carrer ?? ''}`.trim().toLowerCase();
    return key || null;
};

const addressKey = (group?: AddressGroup | null) => {
    const key = `${group?.tipus_carrer ?? ''} ${group?.carrer ?? ''} ${group?.num1 ?? ''}${group?.lletra1 ?? ''}`
        .trim()
        .toLowerCase();
    return key || null;
};

export const MapComponent = memo(function MapComponent({
    data,
    points = [],
    height = '75vh',
    defaultLevel = 'neighbourhood',
    focusAddress = null,
}: MapComponentProps) {
    const [level, setLevel] = useState<ChoroplethLevel>(defaultLevel);
    const [stats, setStats] = useState<{ level: ChoroplethLevel; rows: AreaStat[] } | null>(null);
    const [districtStats, setDistrictStats] = useState<AreaStat[]>([]);
    const [addressGroups, setAddressGroups] = useState<AddressGroup[] | null>(null);
    const [selection, setSelection] = useState<ChoroplethSelection | null>(null);
    const [selectionLevel, setSelectionLevel] = useState<ChoroplethLevel | null>(null);
    const [selectedNeighborhood, setSelectedNeighborhood] = useState<AreaStat | null>(null);
    const [selectedAddress, setSelectedAddress] = useState<AddressGroup | null>(null);
    const [colorDotsByDistrict, setColorDotsByDistrict] = useState(true);
    const pendingDistrictSelectionRef = useRef<ChoroplethSelection | null>(null);

    const config = LEVEL_CONFIG[level];

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
            if (!cancelled) {
                setStats({ level, rows });
            }
        });

        return () => {
            cancelled = true;
        };
    }, [level]);

    useEffect(() => {
        let cancelled = false;

        fetchDistrictStats().then((rows) => {
            if (!cancelled) {
                setDistrictStats(rows.map((row): AreaStat => ({
                    code: row.codi_districte,
                    label: row.nom_districte,
                    apartments: row.apartments_count,
                    places: row.total_places,
                })));
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        fetchApartmentMap().then((groups) => {
            if (!cancelled) setAddressGroups(groups);
        });

        return () => {
            cancelled = true;
        };
    }, []);

    // A district-chart click can switch levels and preserve its pending district selection.
    useEffect(() => {
        const pendingSelection = pendingDistrictSelectionRef.current;
        pendingDistrictSelectionRef.current = null;
        setSelection(pendingSelection);
        setSelectionLevel(pendingSelection ? 'district' : null);
        setSelectedNeighborhood(null);
        setSelectedAddress(null);
    }, [level]);

    const selectedAddresses = useMemo(() => {
        if (!selection || !addressGroups) return null;
        const selectedLevel = selectionLevel ?? level;
        return addressGroups
            .filter((group) => sameCode(selectedLevel === 'district' ? group.codi_districte : group.codi_barri, selection.code))
            .sort((a, b) => b.apartments_count - a.apartments_count || b.total_places - a.total_places);
    }, [selection, selectionLevel, addressGroups, level]);

    useEffect(() => {
        setSelectedNeighborhood(null);
        setSelectedAddress(null);
    }, [selection]);

    // Keeps the map panels in sync with the search: open the area, then its address.
    useEffect(() => {
        if (!focusAddress) return;
        const code = level === 'district' ? focusAddress.codi_districte : focusAddress.codi_barri;
        const label = level === 'district' ? focusAddress.nom_districte : focusAddress.nom_barri;
        if (code === undefined || code === null) return;
        setSelectionLevel(level);
        setSelection((current) => (current && sameCode(current.code, code) ? current : { code, label: label ?? '' }));
    }, [focusAddress, level]);

    useEffect(() => {
        if (!focusAddress || !selectedAddresses) return;
        const key = addressKey(focusAddress);
        const match = selectedAddresses.find((group) => addressKey(group) === key);
        if (match) setSelectedAddress(match);
    }, [focusAddress, selectedAddresses]);

    const resolvedData = useMemo(() => {
        if (data) return data;

        const rows = stats?.level === level ? stats.rows : null;
        if (!rows || rows.length === 0) return config.sampleData;

        return rows.map((row): ChoroplethDatum => ({
            code: row.code,
            value: row.apartments,
            label: row.label,
        }));
    }, [data, level, stats, config.sampleData]);

    const selectedAreaValue = useMemo(() => {
        if (!selection) return null;
        if (selectionLevel === 'district') {
            return districtStats.find((row) => sameCode(row.code, selection.code))?.apartments ?? null;
        }
        return resolvedData.find((datum) => sameCode(datum.code, selection.code))?.value ?? null;
    }, [selection, selectionLevel, districtStats, resolvedData]);

    const selectedDistrictNeighborhoods = useMemo(() => {
        if (selectionLevel !== 'district' || !selection || !addressGroups) return null;

        const neighborhoods = new Map<number, AreaStat>();
        addressGroups.forEach((group) => {
            if (!sameCode(group.codi_districte, selection.code) || group.codi_barri === undefined || group.codi_barri === null) return;

            const code = Number(group.codi_barri);
            const label = group.nom_barri || `Barri ${code}`;
            const current = neighborhoods.get(code);
            if (current) {
                current.apartments += group.apartments_count || 0;
                current.places += group.total_places || 0;
            } else {
                neighborhoods.set(code, { code, label, apartments: group.apartments_count || 0, places: group.total_places || 0 });
            }
        });

        return Array.from(neighborhoods.values())
            .sort((a, b) => b.apartments - a.apartments || a.label.localeCompare(b.label, 'ca'));
    }, [selectionLevel, selection, addressGroups]);
    const maxNeighborhoodApartments = Math.max(...(selectedDistrictNeighborhoods ?? []).map((row) => row.apartments), 1);

    // Small dots for every street+number of the selected area, on top of the search result markers.
    const mapPoints = useMemo(() => {
        if (!colorDotsByDistrict) return [];

        const street = streetKey(selectedAddress);
        const groupsToMap = addressGroups ?? [];
        const addressPoints = groupsToMap.flatMap((group): ChoroplethPoint[] => {
            if (group.longitud_x === undefined || group.latitud_y === undefined) return [];
            const highlighted = group === selectedAddress;
            const onSelectedStreet = Boolean(street) && streetKey(group) === street;
            return [
                {
                    longitude: group.longitud_x,
                    latitude: group.latitud_y,
                    label: highlighted ? group.address : `${group.address} (${formatNumber(group.apartments_count)} habitatges)`,
                    radius: onSelectedStreet ? 4 : 2.5,
                    color: colorDotsByDistrict
                        ? getDistrictColor(group.nom_districte || 'Sense districte')
                        : onSelectedStreet ? '#dc2626' : '#1e293b',
                    opacity: highlighted ? 0.9 : 0.5,
                    highlighted,
                },
            ];
        });
        // The highlighted dot goes last so it is drawn on top of its neighbours.
        const allPoints = [
            ...addressPoints.filter((point) => !point.highlighted),
            ...addressPoints.filter((point) => point.highlighted),
            ...points,
        ];
        const districtByCoordinates = new Map(
            [...groupsToMap, ...(addressGroups ?? [])]
                .filter((group) => group.longitud_x !== undefined && group.latitud_y !== undefined)
                .map((group) => [`${group.longitud_x},${group.latitud_y}`, group.nom_districte || 'Sense districte'])
        );
        const districtByAddress = new Map(
            [...groupsToMap, ...(addressGroups ?? [])]
                .map((group) => [group.address.trim().toLocaleLowerCase('ca'), group.nom_districte || 'Sense districte'])
        );

        return allPoints.map((point) => {
            const district = districtByCoordinates.get(`${point.longitude},${point.latitude}`)
                ?? (point.label ? districtByAddress.get(point.label.trim().toLocaleLowerCase('ca')) : undefined);
            return {
                ...point,
                color: colorDotsByDistrict && district ? getDistrictColor(district) : point.color,
                opacity: point.highlighted ? 0.9 : Math.min(point.opacity ?? 0.5, 0.6),
            };
        });
    }, [selectedAddresses, selectedAddress, selection, points, colorDotsByDistrict, addressGroups]);

    // Every address of the selected street, so the view frames the whole street instead of one dot.
    const streetFocusPoints = useMemo<[number, number][]>(() => {
        const street = streetKey(selectedAddress);
        if (!street || !selectedAddresses) return [];

        return selectedAddresses
            .filter((group) => streetKey(group) === street)
            .filter((group) => group.longitud_x !== undefined && group.latitud_y !== undefined)
            .map((group): [number, number] => [group.longitud_x as number, group.latitud_y as number]);
    }, [selectedAddress, selectedAddresses]);

    const mapFocusPoints = useMemo<[number, number][]>(() => {
        if (selectedAddress?.longitud_x !== undefined && selectedAddress.latitud_y !== undefined) {
            return [[selectedAddress.longitud_x, selectedAddress.latitud_y]];
        }
        return streetFocusPoints;
    }, [selectedAddress, streetFocusPoints]);

    const sortedDistrictStats = useMemo(
        () => [...districtStats].sort((a, b) => b.apartments - a.apartments || a.label.localeCompare(b.label, 'ca')),
        [districtStats]
    );
    const maxDistrictApartments = Math.max(...sortedDistrictStats.map((row) => row.apartments), 1);
    const districtColorsByCode = useMemo(
        () => Object.fromEntries(districtStats.map((district) => [String(district.code), getDistrictColor(district.label)])),
        [districtStats]
    );

    const selectDistrict = (district: AreaStat) => {
        const nextSelection = { code: district.code, label: district.label };
        setSelectionLevel('district');
        setSelectedNeighborhood(null);
        setSelectedAddress(null);
        if (level !== 'neighbourhood') {
            pendingDistrictSelectionRef.current = nextSelection;
            setLevel('neighbourhood');
            return;
        }
        setSelection(nextSelection);
    };

    const selectNeighborhood = (neighborhood: AreaStat) => {
        setSelectedNeighborhood(neighborhood);
        setSelectedAddress(null);
    };

    const handleMapSelection = (nextSelection: ChoroplethSelection | null) => {
        setSelection(nextSelection);
        setSelectionLevel(nextSelection ? level : null);
        setSelectedNeighborhood(null);
        setSelectedAddress(null);
    };

    const closeDetailLevel = () => {
        if (selectedAddress) {
            setSelectedAddress(null);
        } else if (selectedNeighborhood) {
            setSelectedNeighborhood(null);
        } else {
            setSelection(null);
            setSelectionLevel(null);
        }
    };

    const displayedAddresses = useMemo(() => {
        if (!selectedAddresses || !selectedNeighborhood) return selectedAddresses;
        return selectedAddresses.filter((group) => sameCode(group.codi_barri, selectedNeighborhood.code));
    }, [selectedAddresses, selectedNeighborhood]);

    const districtChart = sortedDistrictStats.length > 0 ? (
        <section className="choropleth-district-chart" aria-label="Habitatges per districte">
            <h3 className="choropleth-district-chart__title">Habitatges per districte</h3>
            <div className="form-check mb-2">
                <input
                    id="color-map-dots-by-district"
                    className="form-check-input"
                    type="checkbox"
                    checked={colorDotsByDistrict}
                    onChange={(event) => setColorDotsByDistrict(event.target.checked)}
                />
                <label className="form-check-label small" htmlFor="color-map-dots-by-district">
                    Mostrar punts de color per districte
                </label>
            </div>
            <div className="choropleth-district-chart__list">
                {sortedDistrictStats.map((district) => {
                    const selected = selectionLevel === 'district' && sameCode(selection?.code, district.code);
                    return (
                        <button
                            key={district.code}
                            type="button"
                            className="choropleth-district-chart__item"
                            aria-pressed={selected}
                            onClick={() => selectDistrict(district)}
                        >
                            <span className="choropleth-district-chart__meta">
                                <span>{district.label}</span>
                                <span>{formatNumber(district.apartments)}</span>
                            </span>
                            <span className="choropleth-district-chart__track" aria-hidden="true">
                                <span
                                    className="choropleth-district-chart__fill"
                                    style={{
                                        width: `${(district.apartments / maxDistrictApartments) * 100}%`,
                                        backgroundColor: selected ? '#111827' : getDistrictColor(district.label),
                                    }}
                                />
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    ) : null;

    const detailAreaValue = selectedAddress?.apartments_count ?? selectedNeighborhood?.apartments ?? selectedAreaValue;

    const detail = selection ? (
        <>
            <div className="d-flex justify-content-between align-items-start gap-1">
                <div>
                    <strong>{selectedAddress?.address ?? selectedNeighborhood?.label ?? selection.label}</strong>
                </div>
                {!selectedAddress && (
                    <button
                        type="button"
                        className="btn-close"
                        aria-label={selectedNeighborhood ? 'Tanca el detall del barri' : 'Tanca el detall'}
                        onClick={closeDetailLevel}
                    />
                )}
            </div>
            {detailAreaValue !== null && (
                <p className="choropleth-panel__meta mt-1">
                    {formatNumber(detailAreaValue)} {METRIC_UNIT}
                </p>
            )}
            {!selectedAddress && (
                <>
                    {selectionLevel === 'district' && !selectedNeighborhood && (
                        <section className="choropleth-district-chart" aria-label="Habitatges per barri">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <h3 className="choropleth-district-chart__title mb-0">Distribució per barri</h3>
                                {selectedDistrictNeighborhoods && (
                                    <span className="choropleth-panel__meta">{selectedDistrictNeighborhoods.length} barris</span>
                                )}
                            </div>
                            {selectedDistrictNeighborhoods === null ? (
                                <span className="choropleth-panel__meta">Carregant barris&hellip;</span>
                            ) : selectedDistrictNeighborhoods.length === 0 ? (
                                <span className="choropleth-panel__meta">Sense barris registrats</span>
                            ) : (
                                <div className="choropleth-district-chart__list">
                                    {selectedDistrictNeighborhoods.map((neighborhood) => (
                                        <button
                                            key={neighborhood.code}
                                            type="button"
                                            className="choropleth-district-chart__item"
                                            onClick={() => selectNeighborhood(neighborhood)}
                                        >
                                            <span className="choropleth-district-chart__meta">
                                                <span>{neighborhood.label}</span>
                                                <span>{formatNumber(neighborhood.apartments)}</span>
                                            </span>
                                            <span className="choropleth-district-chart__track" aria-hidden="true">
                                                <span
                                                    className="choropleth-district-chart__fill"
                                                    style={{
                                                        width: `${(neighborhood.apartments / maxNeighborhoodApartments) * 100}%`,
                                                        backgroundColor: getDistrictColor(selection.label),
                                                    }}
                                                />
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {(selectedNeighborhood || level === 'neighbourhood') && (
                        displayedAddresses === null ? (
                            <span className="choropleth-panel__meta">Carregant adreces&hellip;</span>
                        ) : displayedAddresses.length === 0 ? (
                            <span className="choropleth-panel__meta">Sense adreces registrades per aquest barri</span>
                        ) : (
                            <div className="choropleth-detail__list btn-group-vertical">
                                {displayedAddresses.map((group, idx) => (
                                    <button
                                        key={`${group.address}-${idx}`}
                                        type="button"
                                        aria-pressed={selectedAddress === group}
                                        onClick={() => setSelectedAddress(group)}
                                        className="d-flex flex-row btn rounded-0"
                                    >
                                        <div className="choropleth-detail__item">
                                            <span className="choropleth-detail__address">{group.address}</span>
                                            <span className="choropleth-panel__meta">
                                                {formatNumber(group.apartments_count)} habitatges &middot; {formatNumber(group.total_places)} places
                                            </span>
                                        </div>
                                        <FaChevronRight className="align-self-center ms-auto" aria-hidden="true" />
                                    </button>
                                ))}
                            </div>
                        )
                    )}
                </>
            )}

            {selectedAddress && (
                <div className="choropleth-subdetail">
                    <div className="choropleth-subdetail__header d-flex px-4 py-3">
                        <button
                            type="button"
                            className="btn-close ms-auto"
                            aria-label="Torna a les adreces del barri"
                            onClick={() => setSelectedAddress(null)}
                        />
                    </div>
                    <ApartmentDetail group={selectedAddress} />
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
            overlayFilterValue={level === 'district' ? 'BARRI' : undefined}
            overlayCodeProperty="BARRI"
            overlayFocusCode={level === 'district' ? selectedNeighborhood?.code ?? null : null}
            boundaryFilterValue={config.boundaryFilterValue}
            contextLayer={config.contextLayer}
            codeProperty={config.codeProperty}
            labelProperty={config.labelProperty}
            data={resolvedData}
            districtColorsByCode={districtColorsByCode}
            points={mapPoints}
            focusPoints={mapFocusPoints}
            focusCode={selectedNeighborhood?.code ?? selection?.code ?? null}
            focusProperty={selectedNeighborhood ? undefined : selectionLevel === 'district' && level === 'neighbourhood' ? 'DISTRICTE' : undefined}
            metricLabel={METRIC_UNIT}
            showAreaLabels={!selection}
            showAreaValues={Boolean(selection) && level === 'neighbourhood'}
            height={height}
            panelContent={districtChart}
            detail={detail}
            onSelect={handleMapSelection}
        />
    );
});
