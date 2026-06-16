'use client';

import { useState, useRef, useCallback } from 'react';
import { searchApartments } from '@/lib/api';
import { AddressGroup } from '@/lib/types';
import { SearchForm } from './components/SearchForm';
import { ApartmentResults } from './components/ApartmentResults';

export default function Home() {
  const [selectedCarrer, setSelectedCarrer] = useState('');
  const [selectedTipusCarrer, setSelectedTipusCarrer] = useState<string | null>(null);
  const [selectedNum, setSelectedNum] = useState<string | null>(null);

  const [exactGroups, setExactGroups] = useState<AddressGroup[]>([]);
  const [streetGroups, setStreetGroups] = useState<AddressGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const requestIdRef = useRef(0);

  const handleSearch = useCallback(
    (carrer: string, tipusCarrer: string | null, num1: string | null) => {
      setSelectedCarrer(carrer);
      setSelectedTipusCarrer(tipusCarrer);
      setSelectedNum(num1);

      clearTimeout(searchTimerRef.current);
      setLoading(true);
      setShowResults(true);

      searchTimerRef.current = setTimeout(async () => {
        const requestId = ++requestIdRef.current;

        try {
          const [exact, street] = await Promise.all([
            searchApartments({ carrer, tipus_carrer: tipusCarrer, num1 }),
            searchApartments({ carrer, tipus_carrer: tipusCarrer }),
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Cercador de pisos turístics Barcelona
          </h1>
          <p className="mt-2 text-gray-600">
            Cerca una adreça de Barcelona per identificar habitatges amb llicència turística.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Search Section */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Cerca per adreça</h2>
          <p className="mb-6 text-gray-600">
            Selecciona el tipus de via, el carrer i el número per identificar una adreça de Barcelona.
          </p>
          <SearchForm onSearch={handleSearch} />
        </div>

        {/* Results Section */}
        {showResults && (
          <div className="space-y-6">
            {/* Selected Address */}
            {selectedCarrer && (
              <div className="rounded-lg bg-white p-4 shadow">
                <strong className="text-lg text-gray-900">{selectedCarrer}, {selectedNum}</strong>
                <div className="mt-2 text-sm text-gray-600">
                  {selectedTipusCarrer && <span>{selectedTipusCarrer} · </span>}
                  Barcelona
                </div>
              </div>
            )}

            {/* Exact Address Results */}
            <ApartmentResults
              title="Habitatges d'ús turístic (adreça amb número)"
              addressGroups={exactGroups}
              loading={loading}
            />

            {/* Street Results */}
            <ApartmentResults
              title="Habitatges d'ús turístic (carrer, sense número)"
              addressGroups={streetGroups}
              loading={loading}
            />
          </div>
        )}

        {/* Footer Link */}
        <div className="mt-12 border-t border-gray-200 pt-8 text-center text-sm text-gray-600">
          <p>
            Per obtenir ajuda per concretar el lloc dels fets, consulteu el{' '}
            <a
              href="https://geoportal.barcelona.cat/planolBCN/ca/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              plànol de BCN
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
