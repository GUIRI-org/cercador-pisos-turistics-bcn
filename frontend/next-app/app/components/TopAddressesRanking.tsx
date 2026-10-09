'use client';

import { useEffect, useState } from 'react';
import { fetchApartmentMap } from '@/lib/api';
import type { AddressGroup } from '@/lib/types';
import { BuildingList } from './BuildingList';

const RANKING_SIZE = 25;

interface TopAddressesRankingProps {
  onSelectAddress?: (group: AddressGroup) => void;
}

export function TopAddressesRanking({ onSelectAddress }: TopAddressesRankingProps) {
  const [groups, setGroups] = useState<AddressGroup[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchApartmentMap().then((rows) => {
      if (cancelled) return;
      const top = [...rows]
        .sort((a, b) => b.total_places - a.total_places || b.apartments_count - a.apartments_count)
        .slice(0, RANKING_SIZE);
      setGroups(top);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!groups?.length) return null;

  return (
    <BuildingList
      className="street-addresses container"
      groups={groups}
      placesDisplay="waffle"
      onSelectAddress={onSelectAddress}
      title={
        <h4 className="fw-normal">
          Les {RANKING_SIZE}&nbsp;finques amb més places d&apos;habitatges d&apos;ús turístic
        </h4>
      }
    />
  );
}
