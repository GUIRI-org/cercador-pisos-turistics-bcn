'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { searchApartmentsOpenData } from '@/lib/api';
import { AddressGroup } from '@/lib/types';
import { ApartmentResults } from '../components/ApartmentResults';
import { SearchForm, SelectedStreetInfo } from '../components/SearchForm';
import { AppNavbar } from '../components/AppNavbar';
import { ParallaxContainer } from '../components/ParallaxContainer';

const normalizeAddressPart = (value: string | number | null | undefined) => String(value ?? '').trim().toLowerCase();

const getAddressGroupKey = (group: AddressGroup) => {
  return [
    normalizeAddressPart(group.tipus_carrer),
    normalizeAddressPart(group.carrer),
    normalizeAddressPart(group.num1),
    normalizeAddressPart(group.lletra1),
    normalizeAddressPart(group.num2),
    normalizeAddressPart(group.lletra2),
    normalizeAddressPart(group.address),
    normalizeAddressPart(group.latitud_y),
    normalizeAddressPart(group.longitud_x),
  ].join('|');
};

export default function OpenDataSearchPage() {
  const [selectedCarrer, setSelectedCarrer] = useState('');
  const [selectedTipusCarrer, setSelectedTipusCarrer] = useState<string | null>(null);
  const [selectedNum, setSelectedNum] = useState<string | null>(null);

  const [exactGroups, setExactGroups] = useState<AddressGroup[]>([]);
  const [streetGroups, setStreetGroups] = useState<AddressGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchFormKey, setSearchFormKey] = useState(0);

  const searchTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const requestIdRef = useRef(0);

  const handleSearch = useCallback(
    (
      carrer: string,
      tipusCarrer: string | null,
      num1: string | null,
      _streetInfo: SelectedStreetInfo
    ) => {
      setSelectedCarrer(carrer);
      setSelectedTipusCarrer(tipusCarrer);
      setSelectedNum(num1);

      clearTimeout(searchTimerRef.current);
      setLoading(true);
      setShowResults(true);

      searchTimerRef.current = setTimeout(async () => {
        const requestId = ++requestIdRef.current;
        const streetBase = `${tipusCarrer ? `${tipusCarrer} ` : ''}${carrer}`.trim();
        const exactQuery = `${streetBase} ${num1 || ''}`.trim();

        try {
          const [exact, street] = await Promise.all([
            searchApartmentsOpenData(exactQuery),
            searchApartmentsOpenData(streetBase),
          ]);

          if (requestId !== requestIdRef.current) return;

          setExactGroups(exact);
          setStreetGroups(street);
        } catch {
          setExactGroups([]);
          setStreetGroups([]);
        } finally {
          setLoading(false);
        }
      }, 350);
    },
    []
  );

  const handleResetSearch = useCallback(() => {
    clearTimeout(searchTimerRef.current);
    requestIdRef.current += 1;
    setSelectedCarrer('');
    setSelectedTipusCarrer(null);
    setSelectedNum(null);
    setExactGroups([]);
    setStreetGroups([]);
    setLoading(false);
    setShowResults(false);
    setSearchFormKey((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const filteredStreetGroups = useMemo(() => {
    if (!exactGroups.length) return streetGroups;

    const exactAddressKeys = new Set(exactGroups.map(getAddressGroupKey));
    return streetGroups.filter((group) => !exactAddressKeys.has(getAddressGroupKey(group)));
  }, [exactGroups, streetGroups]);

  return (
    <ParallaxContainer>
      <main className="container" style={{ maxWidth: '640px', minHeight: '100vh', paddingTop: '1rem', paddingBottom: '1rem' }}>
        <AppNavbar secondaryHref="/" secondaryLabel="Main search" compact />

        <h1 className="text-3xl font-bold text-gray-900">Alternative Search (OpenData)</h1>
        <p className="mt-2 text-gray-600">
          This page queries the Ajuntament de Barcelona datastore API directly.
        </p>

        <div className="mt-3">
          <SearchForm key={searchFormKey} onSearch={handleSearch} />
        </div>

        {showResults && (
          <div className="space-y-6 relative mt-6">
            <ApartmentResults
              title={`${selectedTipusCarrer ? `${selectedTipusCarrer} ` : ''}${selectedCarrer}${selectedNum ? `, ${selectedNum}` : ''}`.trim()}
              addressGroups={exactGroups}
              loading={loading}
              onResetSearch={handleResetSearch}
            />

            {(loading || filteredStreetGroups.length > 0) && (
              <ApartmentResults
                title={`Same street (${filteredStreetGroups.length})`}
                addressGroups={filteredStreetGroups}
                loading={loading}
              />
            )}
          </div>
        )}
      </main>
    </ParallaxContainer>
  );
}
