'use client';

import type { ReactNode } from 'react';
import type { AddressGroup } from '@/lib/types';
import { formatAddress, formatArea, getAddressGroupKey } from '../lib/addressGroups';
import { PlacesWaffle } from './PlacesWaffle';

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

