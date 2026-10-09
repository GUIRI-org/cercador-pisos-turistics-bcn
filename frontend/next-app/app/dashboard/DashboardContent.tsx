'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { searchApartments } from '@/lib/api';
import type { AddressGroup } from '@/lib/types';
import { AddressNumberDistributionChart, StreetAddressMap } from '../components/ApartmentResults';
import { BuildingList } from '../components/BuildingList';
import { TopAddressesRanking } from '../components/TopAddressesRanking';
import { compareByStreetNumber, dedupeAddressGroups, formatStreetName, getAddressGroupKey } from '../lib/addressGroups';

export function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // The URL is the source of truth for the selected street and building.
    const queryTipusVia = (searchParams.get('tipus_via') ?? '').trim();
    const queryCarrer = (searchParams.get('carrer') ?? '').trim();
    const queryNum = (searchParams.get('num') ?? '').trim();

    const [streetResults, setStreetResults] = useState<AddressGroup[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!queryCarrer) {
            setStreetResults([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        searchApartments({ carrer: queryCarrer, tipus_carrer: queryTipusVia || null })
            .then((street) => {
                if (!cancelled) setStreetResults(street);
            })
            .catch(() => {
                if (!cancelled) setStreetResults([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [queryTipusVia, queryCarrer]);

    const chartGroups = useMemo(
        () => dedupeAddressGroups(streetResults).sort(compareByStreetNumber),
        [streetResults]
    );
    const selectedAddress = chartGroups.find((group) => `${group.num1 ?? ''}` === queryNum) ?? null;
    const selectedKeys = useMemo(
        () => new Set(selectedAddress ? [getAddressGroupKey(selectedAddress)] : []),
        [selectedAddress]
    );
    const streetName = chartGroups.length ? formatStreetName(chartGroups[0]) : `${queryTipusVia} ${queryCarrer}`.trim();

    const handleSelectAddress = useCallback(
        (group: AddressGroup) => {
            if (!group.carrer) return;

            const params = new URLSearchParams();
            if (group.tipus_carrer?.trim()) params.set('tipus_via', group.tipus_carrer.trim());
            params.set('carrer', group.carrer.trim());
            params.set('num', `${group.num1 ?? ''}`);

            router.push(`/dashboard?${params.toString()}`, { scroll: false });
        },
        [router]
    );

    return (
        <>
            {!loading && chartGroups.length > 1 && (
                <section id="seccio-carrer" className="bg-transparent pt-0">
                    <div className="search-results-container container results-extra pt-5">
                        <BuildingList
                            className="street-addresses"
                            groups={chartGroups}
                            streetName={streetName}
                            selectedKeys={selectedKeys}
                            onSelectAddress={handleSelectAddress}
                            title={<h4 className="fw-normal">Altres adreces al carrer <strong>{streetName}</strong> amb habitatges amb llicència d&apos;us turístic</h4>}
                            placesDisplay="waffle"
                        />
                        <StreetAddressMap groups={chartGroups} selectedAddress={selectedAddress} />
                        <AddressNumberDistributionChart groups={chartGroups} streetName={streetName} selectedAddress={selectedAddress} />
                    </div>
                </section>
            )}
            <TopAddressesRanking onSelectAddress={handleSelectAddress} />
        </>
    );
}
