'use client';

import { useEffect, useMemo, useState } from 'react';
import { FaChevronRight, FaRegBuilding } from 'react-icons/fa6';
import { ChoroplethMap, ChoroplethDatum, ChoroplethPoint, ChoroplethSelection, ContextLayer } from './ChoroplethMap';
import { ApartmentDetail } from './StreetDetail';
import { SAMPLE_DISTRICT_DATA, SAMPLE_NEIGHBOURHOOD_DATA } from '../data/sampleChoroplethData';
import { EPSG_25831 } from '../lib/geoUtils';
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

const LEVEL_OPTIONS: { value: ChoroplethLevel; label: string }[] = [
    { value: 'district', label: 'Districtes' },
    { value: 'neighbourhood', label: 'Barris' },
];

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

export function MapComponent({
    data,
    points = [],
    height = 480,
    defaultLevel = 'district',
    focusAddress = null,
}: MapComponentProps) {
    const [level, setLevel] = useState<ChoroplethLevel>(defaultLevel);
    const [stats, setStats] = useState<{ level: ChoroplethLevel; rows: AreaStat[] } | null>(null);
    const [addressGroups, setAddressGroups] = useState<AddressGroup[] | null>(null);
    const [selection, setSelection] = useState<ChoroplethSelection | null>(null);
    const [selectedAddress, setSelectedAddress] = useState<AddressGroup | null>(null);

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
            if (!cancelled) setStats({ level, rows });
        });

        return () => {
            cancelled = true;
        };
    }, [level]);

    useEffect(() => {
        if (!selection || addressGroups) return;
        let cancelled = false;

        fetchApartmentMap().then((groups) => {
            if (!cancelled) setAddressGroups(groups);
        });

        return () => {
            cancelled = true;
        };
    }, [selection, addressGroups]);

    // A searched address needs its own area addresses, which are only fetched once a selection exists.
    useEffect(() => {
        if (!focusAddress || addressGroups) return;
        let cancelled = false;

        fetchApartmentMap().then((groups) => {
            if (!cancelled) setAddressGroups(groups);
        });

        return () => {
            cancelled = true;
        };
    }, [focusAddress, addressGroups]);

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

    // Keeps the map panels in sync with the search: open the area, then its address.
    useEffect(() => {
        if (!focusAddress) return;
        const code = level === 'district' ? focusAddress.codi_districte : focusAddress.codi_barri;
        const label = level === 'district' ? focusAddress.nom_districte : focusAddress.nom_barri;
        if (code === undefined || code === null) return;
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
        return resolvedData.find((datum) => sameCode(datum.code, selection.code))?.value ?? null;
    }, [selection, resolvedData]);

    // Small dots for every street+number of the selected area, on top of the search result markers.
    const mapPoints = useMemo(() => {
        const street = streetKey(selectedAddress);
        const addressPoints = (selectedAddresses ?? []).flatMap((group): ChoroplethPoint[] => {
            if (group.longitud_x === undefined || group.latitud_y === undefined) return [];
            const highlighted = group === selectedAddress;
            const onSelectedStreet = Boolean(street) && streetKey(group) === street;
            return [
                {
                    longitude: group.longitud_x,
                    latitude: group.latitud_y,
                    label: highlighted ? group.address : `${group.address} (${formatNumber(group.apartments_count)} habitatges)`,
                    radius: onSelectedStreet ? 4 : 2.5,
                    color: onSelectedStreet ? '#dc2626' : '#1e293b',
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

    // Every address of the selected street, so the view frames the whole street instead of one dot.
    const streetFocusPoints = useMemo<[number, number][]>(() => {
        const street = streetKey(selectedAddress);
        if (!street || !selectedAddresses) return [];

        return selectedAddresses
            .filter((group) => streetKey(group) === street)
            .filter((group) => group.longitud_x !== undefined && group.latitud_y !== undefined)
            .map((group): [number, number] => [group.longitud_x as number, group.latitud_y as number]);
    }, [selectedAddress, selectedAddresses]);

    const controls = (
        <div className="choropleth-controls">
            <div className="btn-group btn-group-sm d-flex" role="group" aria-label="Divisió territorial">
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
    );

    const detail = selection ? (
        <>
            <div className="d-flex justify-content-between align-items-start gap-1">
                <div>
                    {/* <span className="choropleth-panel__label">Adreces</span> */}
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
            {selectedAreaValue !== null && (
                <p className="choropleth-panel__meta mt-1">
                    {formatNumber(selectedAreaValue)} {METRIC_UNIT}
                </p>
            )}
            {selectedAddresses === null ? (
                <span className="choropleth-panel__meta">Carregant adreces&hellip;</span>
            ) : selectedAddresses.length === 0 ? (
                <span className="choropleth-panel__meta">Sense adreces registrades</span>
            ) : (
                <>
                    <div className="choropleth-detail__list btn-group-vertical">
                        {selectedAddresses.map((group, idx) => (
                            <button
                                key={`${group.address}-${idx}`}
                                type="button"
                                aria-pressed={selectedAddress === group}
                                onClick={() => setSelectedAddress(group)}
                                className="d-flex flex-row btn btn-outline-primary"
                            >
                                <FaRegBuilding className="mt-1 me-2" aria-hidden="true" />
                                <div
                                    className="choropleth-detail__item"
                                >
                                    <span className="choropleth-detail__address">{group.address}</span>
                                    <span className="choropleth-panel__meta">
                                        {formatNumber(group.apartments_count)} habitatges &middot; {formatNumber(group.total_places)} places
                                    </span>
                                </div>
                                <FaChevronRight className="align-self-center ms-auto" aria-hidden="true" />
                            </button>
                        ))}
                    </div>
                </>
            )}

            {
                selectedAddress && (
                    <div className="choropleth-subdetail">
                        <div className='d-flex flex-row'>
                            <FaRegBuilding className="mt-1 me-2" aria-hidden="true" />
                            <div className="d-flex flex-fill justify-content-between align-items-start gap-2">
                                <div>
                                    <strong>{selectedAddress.address}</strong>
                                    <span className="choropleth-panel__meta d-block">
                                        {formatNumber(selectedAddress.apartments_count)} habitatges &middot; {formatNumber(selectedAddress.total_places)} places
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    aria-label="Tanca la distribució"
                                    onClick={() => setSelectedAddress(null)}
                                />
                            </div>
                        </div>
                        
                        <ApartmentDetail
                            group={selectedAddress}
                            allGroups={selectedAddresses ?? []}
                            currentIndex={selectedAddresses?.indexOf(selectedAddress) ?? -1}
                        />
                    </div>
                )
            }
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
            focusPoints={streetFocusPoints}
            focusCode={selection?.code ?? null}
            metricLabel={METRIC_UNIT}
            height={height}
            controls={controls}
            detail={detail}
            onSelect={setSelection}
        />
    );
}
