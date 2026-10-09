'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { SelectInstance } from 'react-select';
import { useRouter, useSearchParams } from 'next/navigation';
import './styles.css';
import './styles-md.css';
import { fetchPortalsByVia, searchApartments, searchCarrers } from '@/lib/api';
import { AddressGroup, CarrerVia } from '@/lib/types';
import { AboutSection } from './components/AboutSection';
import { AppNavbar } from './components/AppNavbar';
import { ApartmentResults } from './components/ApartmentResults';
import { CountdownBanner } from './components/CountdownBanner';
import { IntroSection } from './components/IntroSection';
import { SearchForm } from './components/SearchForm';
import { SiteFooter } from './components/SiteFooter';

const normalizeAddressPart = (value: string | number | null | undefined) => String(value ?? '').trim().toLowerCase();

const RESULTS_ANCHOR_ID = 'seccio-resultats';

type UnitFilters = { escala: string; pis: string; porta: string };

const matchesUnitField = (value: string | undefined, filter: string) => {
  if (!filter.trim()) return true;
  return normalizeAddressPart(value) === normalizeAddressPart(filter);
};

// The GUIRI search endpoint only filters by street and number, so narrow down the units here.
const filterGroupsByUnit = (groups: AddressGroup[], filters: UnitFilters): AddressGroup[] => {
  if (!filters.escala.trim() && !filters.pis.trim() && !filters.porta.trim()) return groups;

  return groups
    .map((group) => {
      const apartments = group.apartments.filter(
        (apt) =>
          matchesUnitField(apt.escala, filters.escala) &&
          matchesUnitField(apt.pis, filters.pis) &&
          matchesUnitField(apt.porta, filters.porta)
      );

      return {
        ...group,
        apartments,
        apartments_count: apartments.length,
        total_places: apartments.reduce((acc, apt) => acc + (apt.num_places || 0), 0),
      };
    })
    .filter((group) => group.apartments.length > 0);
};

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeSearch />
    </Suspense>
  );
}

function HomeSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The URL is the source of truth for the executed search.
  const queryTipusVia = (searchParams.get('tipus_via') ?? '').trim();
  const queryCarrer = (searchParams.get('carrer') ?? '').trim();
  const queryNum = (searchParams.get('num') ?? '').trim();
  const queryEscala = (searchParams.get('escala') ?? '').trim();
  const queryPis = (searchParams.get('pis') ?? '').trim();
  const queryPorta = (searchParams.get('porta') ?? '').trim();

  const [carrerSeed, setCarrerSeed] = useState({ text: '' });
  const [selectedCarrer, setSelectedCarrer] = useState<CarrerVia | null>(null);
  const [numOptions, setNumOptions] = useState<string[]>([]);
  const [num, setNum] = useState('');
  const [escala, setEscala] = useState('');
  const [pis, setPis] = useState('');
  const [porta, setPorta] = useState('');

  const [touched, setTouched] = useState<{ carrer?: boolean; num?: boolean }>({});
  const [results, setResults] = useState<AddressGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [streetNameLoading, setStreetNameLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [numLoading, setNumLoading] = useState(false);

  const portalsAbortRef = useRef<AbortController | null>(null);
  const carrerRequestIdRef = useRef(0);
  const selectedCarrerRequestIdRef = useRef(0);
  const carrerInputRef = useRef<SelectInstance<CarrerVia, false> | null>(null);
  const numInputRef = useRef<SelectInstance<{ value: string; label: string }, false> | null>(null);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const resultsSectionRef = useRef<HTMLElement | null>(null);
  const pendingResultsScrollRef = useRef(false);

  useEffect(() => () => {
    portalsAbortRef.current?.abort();
    ++carrerRequestIdRef.current;
    ++selectedCarrerRequestIdRef.current;
  }, []);

  // Resolve deep-linked street parameters to the human-readable geoBCN label.
  useEffect(() => {
    if (!queryCarrer) {
      setSelectedCarrer(null);
      setCarrerSeed({ text: '' });
      setStreetNameLoading(false);
      return;
    }

    setSelectedCarrer(null);
    setCarrerSeed({ text: `${queryTipusVia} ${queryCarrer}`.trim() });
    setStreetNameLoading(true);
    const requestId = ++carrerRequestIdRef.current;
    let cancelled = false;

    searchCarrers(queryCarrer, queryTipusVia || undefined).then((response) => {
      if (cancelled || requestId !== carrerRequestIdRef.current) return;
      console.log('[geoBCN] URL street response', {
        query: {
          tipus_via: queryTipusVia,
          carrer: queryCarrer,
        },
        response,
      });

      const normalizedQuery = normalizeAddressPart(queryCarrer);
      const via = response.vies.find(
        (candidate) =>
          normalizeAddressPart(candidate.nom) === normalizedQuery ||
          normalizeAddressPart(candidate.nomComplet) === normalizedQuery
      );

      if (via) {
        setSelectedCarrer(via);
      }
      setStreetNameLoading(false);
    });

    return () => {
      cancelled = true;
      setStreetNameLoading(false);
    };
  }, [queryTipusVia, queryCarrer]);

  // Re-runs on every URL change, so deep links, refreshes and back/forward all rebuild the results.
  useEffect(() => {
    if (!queryCarrer || !queryNum) {
      pendingResultsScrollRef.current = false;
      setShowResults(false);
      setResults([]);
      setLoading(false);
      setStreetNameLoading(false);
      return;
    }

    setNum(queryNum);
    setEscala(queryEscala);
    setPis(queryPis);
    setPorta(queryPorta);
    setShowResults(true);
    setLoading(true);

    const carrer = queryCarrer;
    const tipusCarrer = queryTipusVia || null;
    let cancelled = false;

    searchApartments({ carrer, tipus_carrer: tipusCarrer, num1: queryNum })
      .then((exact) => {
        if (cancelled) return;
        setResults(filterGroupsByUnit(exact, { escala: queryEscala, pis: queryPis, porta: queryPorta }));
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
      })
      .finally(() => {
        if (!cancelled) {
          pendingResultsScrollRef.current = true;
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [queryTipusVia, queryCarrer, queryNum, queryEscala, queryPis, queryPorta]);

  useEffect(() => {
    if (!showResults || loading || streetNameLoading || !pendingResultsScrollRef.current) return;

    const frame = requestAnimationFrame(() => {
      resultsSectionRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
      pendingResultsScrollRef.current = false;
    });

    return () => cancelAnimationFrame(frame);
  }, [showResults, loading, streetNameLoading]);

  // Runs on every keystroke in the street field; each setter must bail out when nothing changed.
  const handleCarrerEdit = useCallback(() => {
    setStreetNameLoading(false);
    setSelectedCarrer(null);
    setNumOptions((prev) => (prev.length ? [] : prev));
    setNum('');
    portalsAbortRef.current?.abort();
    ++selectedCarrerRequestIdRef.current;
    ++carrerRequestIdRef.current;
    setNumLoading(false);
  }, []);

  const handleSelectCarrer = async (via: CarrerVia) => {
    setTouched((prev) => ({ ...prev, carrer: true }));

    const requestId = ++selectedCarrerRequestIdRef.current;
    ++carrerRequestIdRef.current;
    portalsAbortRef.current?.abort();
    const controller = new AbortController();
    portalsAbortRef.current = controller;
    setSelectedCarrer(via);
    setNumOptions([]);
    setNum('');
    setNumLoading(true);
    const addresses = await fetchPortalsByVia(via.codi, controller.signal);
    if (requestId !== selectedCarrerRequestIdRef.current) return;
    setNumLoading(false);

    const nums = [...new Set(
      addresses.map((address) => address.numeracioPostal)
    )]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ca', { numeric: true, sensitivity: 'base' }));

    setNumOptions(nums);
    setNum('');

    // The number input is only enabled once a street is selected, so wait for the re-render.
    requestAnimationFrame(() => {
      numInputRef.current?.focus();
      numInputRef.current?.openMenu('first');
    });
  };

  const carrerName = selectedCarrer?.nom ?? queryCarrer;
  const carrerDisplayName = selectedCarrer?.nomComplet ?? `${selectedCarrer?.tipusVia?.nom || ''} ${selectedCarrer?.nom || queryCarrer}`.trim();
  const tipusViaName = selectedCarrer?.tipusVia?.nom ?? queryTipusVia;
  const carrerError = touched.carrer && !carrerName;
  const numError = touched.num && !num;
  const canSearch = Boolean(carrerName) && num.trim().length > 0;

  const pushSearch = useCallback(
    (values: { tipusVia?: string; carrer: string; num: string; escala?: string; pis?: string; porta?: string }) => {
      if (!values.carrer || !values.num.trim()) return;

      const params = new URLSearchParams();
      if (values.tipusVia?.trim()) params.set('tipus_via', values.tipusVia.trim());
      params.set('carrer', values.carrer.trim());
      params.set('num', values.num.trim());
      // Optional unit filters are omitted when empty to keep the URL clean.
      if (values.escala?.trim()) params.set('escala', values.escala.trim());
      if (values.pis?.trim()) params.set('pis', values.pis.trim());
      if (values.porta?.trim()) params.set('porta', values.porta.trim());

      router.push(`/?${params.toString()}#${RESULTS_ANCHOR_ID}`, { scroll: false });
    },
    [router]
  );

  const handleSearch = useCallback(() => {
    setTouched({ carrer: true, num: true });
    pushSearch({ tipusVia: tipusViaName, carrer: carrerName, num, escala, pis, porta });
  }, [pushSearch, carrerName, tipusViaName, num, escala, pis, porta]);

  const handleResetSearch = useCallback(() => {
    pendingResultsScrollRef.current = false;
    portalsAbortRef.current?.abort();
    ++carrerRequestIdRef.current;
    ++selectedCarrerRequestIdRef.current;
    setNumLoading(false);
    setTouched({});
    setSelectedCarrer(null);
    setCarrerSeed({ text: '' });
    setNumOptions([]);
    setNum('');
    setEscala('');
    setPis('');
    setPorta('');
    setResults([]);
    setShowResults(false);
    setLoading(false);
    setStreetNameLoading(false);
    router.push('/', { scroll: false });
    requestAnimationFrame(() => carrerInputRef.current?.focus());
  }, [router]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleSearch();
    },
    [handleSearch]
  );

  return (
    <main className="app-wrapper" style={{ minHeight: '100vh' }}>

      <AppNavbar />

      <IntroSection />

      <SearchForm
        carrerSeed={carrerSeed}
        selectedCarrer={selectedCarrer}
        num={num}
        numOptions={numOptions}
        carrerError={carrerError}
        numError={numError}
        canSearch={canSearch}
        carrerInputRef={carrerInputRef}
        numLoading={numLoading}
        numInputRef={numInputRef}
        searchButtonRef={searchButtonRef}
        onSubmit={handleSubmit}
        onCarrerEdit={handleCarrerEdit}
        onSelectCarrer={handleSelectCarrer}
        onNumChange={setNum}
        onCarrerBlur={() => setTouched((prev) => ({ ...prev, carrer: true }))}
        onNumBlur={() => setTouched((prev) => ({ ...prev, num: true }))}
      />

      {showResults && (
        <ApartmentResults
          title={`${carrerDisplayName}${num ? `, ${num}` : ''}`.trim()}
          streetName={carrerDisplayName}
          addressGroups={results}
          reference={resultsSectionRef}
          loading={loading || streetNameLoading}
          onResetSearch={handleResetSearch}
        />
      )}

      <AboutSection />

      <CountdownBanner />

      <SiteFooter />
    </main>
  );
}
