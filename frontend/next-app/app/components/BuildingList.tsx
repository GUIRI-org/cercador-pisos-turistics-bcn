'use client';

import type { ReactNode } from 'react';
import { FaChevronRight } from 'react-icons/fa6';
import type { AddressGroup } from '@/lib/types';
import { formatAddress, formatArea, getAddressGroupKey } from '../lib/addressGroups';
import { PlacesWaffle } from './PlacesWaffle';
import { ChoroplethMap } from './ChoroplethMap';
import { useEffect, useMemo, useState } from 'react';
import { EPSG_25831 } from '../lib/geoUtils';

interface BuildingListProps {
    groups: AddressGroup[];
    streetName?: string;
    title?: ReactNode;
    /** Keys (see `getAddressGroupKey`) of the buildings to highlight. */
    selectedKeys?: ReadonlySet<string>;
    onSelectAddress?: (group: AddressGroup) => void;
    /** `badge` shows totals; `waffle` shows the places of each floor, top floor first. */
    placesDisplay?: 'badge' | 'waffle';
    className?: string;
}


const BARRIS_GEOJSON = '/geo/barcelona-barris.geojson';

const COMARQUES_CONTEXT = {
    geoJsonUrl: '/geo/dts_comarques_8comarques.geojson',
    stroke: '#94a3b8',
    strokeWidth: 1.5,
};

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
        <div className="choropleth-square me-3" style={{ maxWidth: '120px' }}>
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
    );
}


export function BuildingList({
    groups,
    streetName,
    title,
    selectedKeys,
    onSelectAddress,
    placesDisplay = 'badge',
    className = 'street-addresses',
}: BuildingListProps) {
    return (
        <section className={className}>
            {title}
            <ul className={`rounded-0 p-0 d-grid grid-cols-1 ${groups.length > 1 ? 'md:grid-cols-2' : ''} gap-3`}>
                {groups.map((group) => {
                    const key = getAddressGroupKey(group);
                    const isSelected = selectedKeys?.has(key) ?? false;
                    const areas = formatArea(group);
                    return (
                        <li
                            key={key}
                            className={`bg-white street-addresses__item ${isSelected ? 'street-addresses__item--selected' : ''}`}
                        >
                            <button
                                type="button"
                                className={`d-flex h-100 street-addresses__button ${isSelected ? 'street-addresses__button--selected' : ''}`}
                                aria-current={isSelected ? 'true' : undefined}
                                onClick={() => onSelectAddress?.(group)}
                            >
                                {/* <AddressLocationMaps group={group} streetName={streetName} /> */}

                                <span className="d-flex flex-column gap-0 flex-grow-1">
                                    {areas.length > 0 && (
                                        <small className="text-body-secondary">{areas.join(' · ')}</small>
                                    )}
                                    <span className="fw-normal fs-5">{formatAddress(group, streetName)}</span>
                                    <small className="text-body-secondary">
                                        {group.apartments_count} habitatges · {group.total_places} places
                                    </small>
                                </span>

                                {placesDisplay === 'waffle' && (
                                    <span className="d-flex flex-column align-items-end justify-content-end me-2">
                                        <PlacesWaffle apartments={group.apartments} />
                                    </span>
                                )}

                                {/* <FaChevronRight className="street-addresses__chevron" aria-hidden="true" /> */}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
async function fetchApartmentMap(): Promise<AddressGroup[]> {
    throw new Error('Function not implemented.');
}

