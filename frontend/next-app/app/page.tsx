'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { searchApartments } from '@/lib/api';
import { AddressGroup } from '@/lib/types';
import { SearchForm, SelectedStreetInfo } from './components/SearchForm';
import { ApartmentResults } from './components/ApartmentResults';
import { ParallaxContainer } from './components/ParallaxContainer';

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

export default function Home() {
  const [selectedCarrer, setSelectedCarrer] = useState('');
  const [selectedTipusCarrer, setSelectedTipusCarrer] = useState<string | null>(null);
  const [selectedNum, setSelectedNum] = useState<string | null>(null);
  const [selectedStreetInfo, setSelectedStreetInfo] = useState<SelectedStreetInfo | null>(null);

  const [exactGroups, setExactGroups] = useState<AddressGroup[]>([]);
  const [streetGroups, setStreetGroups] = useState<AddressGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchFormKey, setSearchFormKey] = useState(0);

  const searchTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const requestIdRef = useRef(0);

  // Sticky form state
  const [formIsFixed, setFormIsFixed] = useState(false);
  const [formHeight, setFormHeight] = useState(0);
  const formPanelRef = useRef<HTMLDivElement>(null);
  const formNaturalTopRef = useRef<number | null>(null);

  const handleSearch = useCallback(
    (
      carrer: string,
      tipusCarrer: string | null,
      num1: string | null,
      streetInfo: SelectedStreetInfo
    ) => {
      setSelectedCarrer(carrer);
      setSelectedTipusCarrer(tipusCarrer);
      setSelectedNum(num1);
      setSelectedStreetInfo(streetInfo);

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

  const handleResetSearch = useCallback(() => {
    clearTimeout(searchTimerRef.current);
    requestIdRef.current += 1;

    setSelectedCarrer('');
    setSelectedTipusCarrer(null);
    setSelectedNum(null);
    setSelectedStreetInfo(null);
    setExactGroups([]);
    setStreetGroups([]);
    setLoading(false);
    setShowResults(false);
    setFormIsFixed(false);
    setSearchFormKey((prev) => prev + 1);
    formNaturalTopRef.current = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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

  useEffect(() => {
    if (!formPanelRef.current) return;
    // Re-measure after sticky class/styles are applied so dependent sticky offsets stay aligned.
    setFormHeight(formPanelRef.current.offsetHeight);
  }, [formIsFixed, showResults]);

  const filteredStreetGroups = useMemo(() => {
    if (!exactGroups.length) return streetGroups;

    const exactAddressKeys = new Set(exactGroups.map(getAddressGroupKey));
    return streetGroups.filter((group) => !exactAddressKeys.has(getAddressGroupKey(group)));
  }, [exactGroups, streetGroups]);

  return (
    <ParallaxContainer>
      <nav className="navbar">
        <div className="container">
          <a className="navbar-brand" href="#">
            <img src="guiri-gamba.svg" alt="Guiri Gamba" width="32" height="32" className="d-inline-block" /> El Guiri
          </a>
          {/* <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarText" aria-controls="navbarText" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarText">
            <span className="navbar-text">
              Navbar text with an inline element
            </span>
          </div> */}
        </div>
      </nav>
      <main className="container" style={{ maxWidth: '640px' }}>
        <div className="border mt-4">
          <h1 className="text-3xl font-bold text-gray-900">
            Barcelona Tourist Apartments
          </h1>
          <p className="mt-2 text-gray-600">
            Join our community and find the perfect guiri apartment in Barcelona
          </p>
        </div>

        {/* Content */}
        {/* Search Section - Sticky */}
        <div
          ref={formPanelRef}
          className={`transition-all duration-200 ${formIsFixed
            ? 'fixed left-0 right-0 top-0 z-20 bg-slate-50/90'
            : 'relative'
            }`}
          style={
            formIsFixed
              ? {
                maxWidth: '640px',
                marginLeft: 'auto',
                marginRight: 'auto',
                left: 'calc(50% - 320px)',
                right: 'calc(50% - 320px)',
                paddingLeft: '1rem',
                paddingRight: '1rem',
                paddingTop: '1rem',
                paddingBottom: '1rem',
              }
              : {}
          }
        >
          <SearchForm
            key={searchFormKey}
            onSearch={handleSearch}
          />
        </div>

        {/* Spacer when form is fixed */}
        {formIsFixed && <div style={{ height: `${formHeight}px` }} />}

        {/* Results Section */}
        {showResults && (
          <div className="space-y-6 relative mt-6">
            {/* Exact Address Results */}
            <ApartmentResults
              title={`${selectedTipusCarrer ? `${selectedTipusCarrer} ` : ''}${selectedCarrer}${selectedNum ? `, ${selectedNum}` : ''}`.trim()}
              addressGroups={exactGroups}
              loading={loading}
              onResetSearch={handleResetSearch}
            />
            {/* Selected Address */}
            {/* {selectedCarrer && (
              <div
                className={`alert alert-light z-10`}
              >
                <div>
                  <strong className="text-lg text-gray-900">
                    {selectedCarrer}, {selectedNum}
                  </strong>
                  <div className="mt-2 text-sm text-gray-600">
                    {selectedTipusCarrer && <span>{selectedTipusCarrer} · </span>}
                    Barcelona
                  </div>
                  {selectedStreetInfo && (
                    <div className="mt-2 text-sm text-gray-700">
                      <div>
                        Via completa: {selectedStreetInfo.nomComplet || `${selectedStreetInfo.tipusViaNom || ''} ${selectedStreetInfo.nom}`.trim()}
                      </div>
                      <div>
                        Codi via: {selectedStreetInfo.codi}
                        {selectedStreetInfo.tipusViaCodi ? ` · Codi tipus via: ${selectedStreetInfo.tipusViaCodi}` : ''}
                      </div>
                      <div>Números disponibles detectats: {selectedStreetInfo.availableNumbers}</div>
                    </div>
                  )}
                </div>
              </div>
            )} */}



            {/* Street Results */}
            <ApartmentResults
              title={`Other addresses on ${selectedTipusCarrer ? `${selectedTipusCarrer} ` : ''}${selectedCarrer} (${filteredStreetGroups.length})`}
              addressGroups={filteredStreetGroups}
              loading={loading}
            />
          </div>
        )}

        {/* Footer Link */}
        {/* <div className="mt-12 border-t border-gray-200 pt-8 text-center text-sm text-gray-600 relative">
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
        </div> */}
      </main>
    </ParallaxContainer>
  );
}
