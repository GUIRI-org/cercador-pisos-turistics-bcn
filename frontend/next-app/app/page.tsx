'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { searchApartments } from '@/lib/api';
import { AddressGroup } from '@/lib/types';
import { SearchForm } from './components/SearchForm';
import { ApartmentResults } from './components/ApartmentResults';
import { ParallaxContainer } from './components/ParallaxContainer';

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

  // Sticky form state
  const [formIsFixed, setFormIsFixed] = useState(false);
  const [formHeight, setFormHeight] = useState(0);
  const formPanelRef = useRef<HTMLDivElement>(null);
  const formNaturalTopRef = useRef<number | null>(null);

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

  // Handle sticky form behavior — desktop only (md+)
  useEffect(() => {
    const syncStickyForm = () => {
      if (!formPanelRef.current) return;

      // On mobile (< md = 768px) never fix — let layout flow
      if (window.innerWidth < 768) {
        setFormIsFixed(false);
        return;
      }

      if (formNaturalTopRef.current === null) {
        // First call: measure natural offset from document top
        const rect = formPanelRef.current.getBoundingClientRect();
        formNaturalTopRef.current = rect.top + window.scrollY;
        setFormHeight(formPanelRef.current.offsetHeight);
      }

      const shouldFix = window.scrollY >= (formNaturalTopRef.current ?? 0);
      setFormIsFixed(shouldFix);
    };

    // Re-evaluate on resize (e.g. rotating phone → tablet)
    const onResize = () => {
      formNaturalTopRef.current = null;
      syncStickyForm();
    };

    // Initial measurement after layout settles
    requestAnimationFrame(() => {
      formNaturalTopRef.current = null;
      syncStickyForm();
    });

    window.addEventListener('scroll', syncStickyForm, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', syncStickyForm);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <ParallaxContainer>
      <main className={`min-h-screen flex flex-col ${showResults ? '' : 'justify-center'}`}>
        {/* Header */}
        <div className="relative z-10">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Barcelona Tourist Apartments
            </h1>
            <p className="mt-2 text-gray-600">
              Welcome to the Barcelona Tourist Apartment Finder
            </p>
          </div>
        </div>

        {/* Content */}
        <div
          className={`mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 ${showResults ? 'py-8' : 'py-4'}`}
        >
          {/* Search Section - Sticky */}
          <div
            ref={formPanelRef}
            className={`transition-all duration-200 ${
              formIsFixed
                ? 'fixed left-0 right-0 top-0 z-20 bg-transparent'
                : 'relative bg-transparent'
            }`}
            style={
              formIsFixed
                ? {
                    maxWidth: '56rem',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    left: 'calc(50% - 28rem)',
                    right: 'calc(50% - 28rem)',
                    paddingLeft: '1rem',
                    paddingRight: '1rem',
                    paddingTop: '1rem',
                    paddingBottom: '1rem',
                  }
                : {}
            }
          >
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Join our community and find the perfect guiri apartment in Barcelona</h2>
            <SearchForm onSearch={handleSearch} />
          </div>

          {/* Spacer when form is fixed */}
          {formIsFixed && <div style={{ height: `${formHeight}px` }} />}

          {/* Results Section */}
          {showResults && (
            <div className="space-y-6 relative">
              {/* Selected Address */}
              {selectedCarrer && (
                <div className="rounded-lg border border-white/40 bg-transparent p-4 backdrop-blur-sm">
                  <strong className="text-lg text-gray-900">
                    {selectedCarrer}, {selectedNum}
                  </strong>
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
          <div className="mt-12 border-t border-gray-200 pt-8 text-center text-sm text-gray-600 relative">
            <p>
              A project created with the aim of benefiting citizenship by {' '}
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                El Guiri
              </a>
              .
            </p>
          </div>
        </div>
      </main>
    </ParallaxContainer>
  );
}
