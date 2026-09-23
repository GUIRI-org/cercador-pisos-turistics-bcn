'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import './styles.css';
import { fetchPortalsByVia, fetchTipusVies, searchApartments, searchCarrers } from '@/lib/api';
import { AddressGroup, CarrerVia, TipusVia } from '@/lib/types';
import { AppNavbar } from './components/AppNavbar';
import { ApartmentResults } from './components/ApartmentResults';
import { MapComponent } from './components/MapComponent';
import { SearchForm } from './components/SearchForm';
import type { ChoroplethPoint } from './components/ChoroplethMap';

const normalizeAddressPart = (value: string | number | null | undefined) => String(value ?? '').trim().toLowerCase();

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

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

// Geoportal street names don't always match how they're stored in the GUIRI DB — add exceptions here as they're found.
const CARRER_NAME_OVERRIDES: Record<string, string> = {
  'PARAL·LEL': 'PARAL.LEL',
};

const normalizeCarrerForApi = (carrer: string): string => {
  const upper = carrer.trim().toUpperCase();
  return CARRER_NAME_OVERRIDES[upper] ?? carrer;
};

const RESULTS_ANCHOR_ID = 'seccio-resultats';

type UnitFilters = { escala: string; pis: string; porta: string };

type GeoBcnSearchResponse = Awaited<ReturnType<typeof searchCarrers>>;

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

  const [tipusVies, setTipusVies] = useState<TipusVia[]>([]);
  const [tipusVia, setTipusVia] = useState('');

  const [carrerInput, setCarrerInput] = useState('');
  const [carrerSuggestions, setCarrerSuggestions] = useState<CarrerVia[]>([]);
  const [selectedCarrer, setSelectedCarrer] = useState<CarrerVia | null>(null);
  const [numOptions, setNumOptions] = useState<string[]>([]);
  const [num, setNum] = useState('');
  const [escala, setEscala] = useState('');
  const [pis, setPis] = useState('');
  const [porta, setPorta] = useState('');

  const [touched, setTouched] = useState<{ carrer?: boolean; num?: boolean }>({});
  const [results, setResults] = useState<AddressGroup[]>([]);
  const [streetResults, setStreetResults] = useState<AddressGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [streetNameLoading, setStreetNameLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const carrerTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const geoBcnResponseRef = useRef<{ query: string; response: GeoBcnSearchResponse } | null>(null);
  const carrerRequestIdRef = useRef(0);
  const selectedCarrerRequestIdRef = useRef(0);
  const searchSectionRef = useRef<HTMLDivElement | null>(null);
  const carrerInputRef = useRef<HTMLInputElement | null>(null);
  const numInputRef = useRef<HTMLSelectElement | null>(null);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    fetchTipusVies().then(setTipusVies);
  }, []);

  useEffect(() => {
    console.log('[geoBCN] numOptions state', numOptions);
  }, [numOptions]);

  // Resolve deep-linked street parameters to the human-readable geoBCN label.
  useEffect(() => {
    if (!queryCarrer) {
      setSelectedCarrer(null);
      setCarrerInput('');
      setStreetNameLoading(false);
      return;
    }

    setSelectedCarrer(null);
    setCarrerInput(`${queryTipusVia} ${queryCarrer}`.trim());
    setStreetNameLoading(true);
    let cancelled = false;

    searchCarrers(queryCarrer, queryTipusVia || undefined).then((response) => {
      if (cancelled) return;

      geoBcnResponseRef.current = {
        query: queryCarrer.toLocaleLowerCase('ca'),
        response,
      };
      console.log('[geoBCN] URL street response', {
        query: {
          tipus_via: queryTipusVia,
          carrer: queryCarrer,
        },
        response,
      });

      const normalizedQuery = normalizeAddressPart(normalizeCarrerForApi(queryCarrer));
      const via = response.vies.find(
        (candidate) =>
          normalizeAddressPart(candidate.nom) === normalizedQuery ||
          normalizeAddressPart(candidate.nomComplet) === normalizedQuery
      );

      if (via) {
        setSelectedCarrer(via);
        setCarrerInput(via.nomComplet ?? via.nom);
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
      setShowResults(false);
      setResults([]);
      setStreetResults([]);
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

    const carrer = normalizeCarrerForApi(queryCarrer);
    const tipusCarrer = queryTipusVia || null;
    let cancelled = false;

    Promise.all([
      searchApartments({ carrer, tipus_carrer: tipusCarrer, num1: queryNum }),
      searchApartments({ carrer, tipus_carrer: tipusCarrer }),
    ])
      .then(([exact, street]) => {
        if (cancelled) return;
        setResults(filterGroupsByUnit(exact, { escala: queryEscala, pis: queryPis, porta: queryPorta }));
        setStreetResults(street);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
        setStreetResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryTipusVia, queryCarrer, queryNum, queryEscala, queryPis, queryPorta]);

  const handleCarrerInput = (value: string) => {
    setCarrerInput(value);
    setSelectedCarrer(null);
    setNumOptions([]);
    setNum('');
    clearTimeout(carrerTimerRef.current);
    const requestId = ++carrerRequestIdRef.current;

    if (value.trim().length < 2) {
      setCarrerSuggestions([]);
      return;
    }

    const normalizedValue = value.trim().toLocaleLowerCase('ca');
    const cached = geoBcnResponseRef.current;
    if (cached && normalizedValue.startsWith(cached.query)) {
      const filteredVies = cached.response.vies.filter((via) => {
        const label = (via.nomComplet || `${via.tipusVia?.nom || ''} ${via.nom}`).toLocaleLowerCase('ca');
        return label.includes(normalizedValue);
      });
      setCarrerSuggestions(filteredVies);
      return;
    }

    carrerTimerRef.current = setTimeout(async () => {
      const response = await searchCarrers(value, tipusVia || undefined);
      if (requestId !== carrerRequestIdRef.current) return;

      geoBcnResponseRef.current = { query: normalizedValue, response };
      console.log('[geoBCN] street search response', response);
      setCarrerSuggestions(response.vies);
    }, 300);
  };

  const handleSelectCarrer = async (codi: string) => {
    const via = carrerSuggestions.find((v) => v.codi === codi) || null;
    setTouched((prev) => ({ ...prev, carrer: true }));

    if (!via) {
      setNumOptions([]);
      return;
    }

    const requestId = ++selectedCarrerRequestIdRef.current;
    const addresses = await fetchPortalsByVia(via.codi);
    if (requestId !== selectedCarrerRequestIdRef.current) return;

    console.log('[geoBCN] selected street portals response', {
      id_via: via.codi,
      adreces: addresses,
    });

    setSelectedCarrer(via);
    setCarrerInput(via.nomComplet ?? via.nom);

    const nums = [...new Set(
      addresses.map((address) => address.numeracioPostal)
    )]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ca', { numeric: true, sensitivity: 'base' }));

    console.log('[geoBCN] numOptions from selected street response', nums);
    setNumOptions(nums);
    setNum('');

    // The number input is only enabled once a street is selected, so wait for the re-render.
    requestAnimationFrame(() => numInputRef.current?.focus());
  };

  const handleCarrerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown') return;
    const first = carrerSuggestions[0];
    if (!selectedCarrer && first) {
      e.preventDefault();
      handleSelectCarrer(first.codi);
    } else if (e.key === 'Enter' && selectedCarrer) {
      e.preventDefault();
      numInputRef.current?.focus();
    }
  };

  const handleNumKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    setTouched((prev) => ({ ...prev, num: true }));
    if (num.trim()) searchButtonRef.current?.focus();
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

  const handleSelectAddress = useCallback(
    (group: AddressGroup) => {
      setResults([]);
      setStreetResults([]);
      setShowResults(true);
      setLoading(true);
      pushSearch({
        tipusVia: group.tipus_carrer ?? '',
        carrer: group.carrer ?? '',
        num: `${group.num1 ?? ''}`,
      });
    },
    [pushSearch]
  );

  const handleResetSearch = useCallback(() => {
    setTouched({});
    setSelectedCarrer(null);
    setCarrerInput('');
    setCarrerSuggestions([]);
    setNumOptions([]);
    setNum('');
    setEscala('');
    setPis('');
    setPorta('');
    setResults([]);
    setStreetResults([]);
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

    <main className="" style={{ minHeight: '100vh' }}>

      <AppNavbar secondaryHref="/search-v1" secondaryLabel="Search v1" />
      <section id="seccio-introduccio" className="container py-5">
        <h1>Secció introducció</h1>
        <p>Aquesta secció proporciona una introducció a la funcionalitat de cerca d'habitatges amb llicència a la ciutat de Barcelona.</p>
      </section>
      <section id="seccio-cerca">
        <h1 className="container">Secció de cerca</h1>
        <div className="bg-light py-5">
          <div className="container d-flex flex-column">
            <div className="row">
              <div className="col-12 col-md-9">
                <h1 className="">Consulta els habitatges que tenen llicència</h1>
                <p className="fs-4 text-gray-600 lh-base">
                  Detecta fàcilment si a la teva finca hi ha habitatges d'ús turístic sense llicència, o si creus que pots estar allotjat en un d'ells.
                </p>
                <p className="text-gray-600 italic">
                  Omple les caselles. Si la teva adreça no hi apareix, el pis que busques és il·legal. (Per a habitatges de la ciutat de Barcelona.)
                </p>
              </div>
            </div>
          </div>

          <SearchForm
            carrerInput={carrerInput}
            carrerSuggestions={carrerSuggestions}
            selectedCarrer={selectedCarrer}
            num={num}
            numOptions={numOptions}
            carrerError={carrerError}
            numError={numError}
            canSearch={canSearch}
            carrerInputRef={carrerInputRef}
            numInputRef={numInputRef}
            searchButtonRef={searchButtonRef}
            onSubmit={handleSubmit}
            onCarrerInput={handleCarrerInput}
            onSelectCarrer={handleSelectCarrer}
            onNumChange={setNum}
            onCarrerKeyDown={handleCarrerKeyDown}
            onNumKeyDown={handleNumKeyDown}
            onCarrerBlur={() => setTouched((prev) => ({ ...prev, carrer: true }))}
            onNumBlur={() => setTouched((prev) => ({ ...prev, num: true }))}
          />

        </div>
      </section>
      <section id="seccio-resultats">
        {showResults && (
          <div className="bg-white border-top search-results-container">
            <div className="d-flex flex-column gap-4">
              <ApartmentResults
                title={`${carrerDisplayName}${num ? `, ${num}` : ''}`.trim()}
                streetName={carrerDisplayName}
                addressGroups={results}
                streetGroups={streetResults}
                loading={loading || streetNameLoading}
                onResetSearch={handleResetSearch}
                onSelectAddress={handleSelectAddress}
                singleResult={results.length === 1}
              />
              <button
                type="button"
                className="btn btn-outline-secondary ms-auto"
                accessKey="e"
                title="Esborrar (Alt+E)"
                onClick={handleResetSearch}
              >
                Esborrar
              </button>
            </div>
          </div>
        )}
        {/* <!-- end of the search form --> */}
      </section>
      <section id="seccio-mapa">
        <h1 className="container">Secció del mapa</h1>
        <div className='map-container bg-light border-top'>
          <MapComponent
            points={results.flatMap((group): ChoroplethPoint[] => {
              if (group.longitud_x === undefined || group.latitud_y === undefined) return [];
              return [{ longitude: group.longitud_x, latitude: group.latitud_y, label: group.address }];
            })}
          />
        </div>
      </section>
      <section id="seccio-about" className="container py-5">
        <h1>Secció about</h1>
        <p>Aquesta secció proporciona informació sobre el projecte i els seus objectius.</p>
      </section>
    </main>
  );
}

