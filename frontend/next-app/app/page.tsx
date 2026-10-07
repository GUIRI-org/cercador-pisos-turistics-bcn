'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { SelectInstance } from 'react-select';
import { useRouter, useSearchParams } from 'next/navigation';
import './styles.css';
import { fetchPortalsByVia, searchApartments, searchCarrers } from '@/lib/api';
import { AddressGroup, CarrerVia } from '@/lib/types';
import { AppNavbar } from './components/AppNavbar';
import { ApartmentResults } from './components/ApartmentResults';
import { CountdownBanner } from './components/CountdownBanner';
import { MapComponent } from './components/MapComponent';
import { SearchForm } from './components/SearchForm';

const normalizeAddressPart = (value: string | number | null | undefined) => String(value ?? '').trim().toLowerCase();

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
  const [carrerLoading, setCarrerLoading] = useState(false);
  const [numLoading, setNumLoading] = useState(false);

  const carrerTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const carrerAbortRef = useRef<AbortController | null>(null);
  const portalsAbortRef = useRef<AbortController | null>(null);
  const geoBcnResponseRef = useRef<{ query: string; response: GeoBcnSearchResponse } | null>(null);
  const carrerRequestIdRef = useRef(0);
  const selectedCarrerRequestIdRef = useRef(0);
  const carrerInputRef = useRef<SelectInstance<CarrerVia, false> | null>(null);
  const numInputRef = useRef<SelectInstance<{ value: string; label: string }, false> | null>(null);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const resultsSectionRef = useRef<HTMLElement | null>(null);
  const pendingResultsScrollRef = useRef(false);

  useEffect(() => () => {
    clearTimeout(carrerTimerRef.current);
    carrerAbortRef.current?.abort();
    portalsAbortRef.current?.abort();
    ++carrerRequestIdRef.current;
    ++selectedCarrerRequestIdRef.current;
  }, []);

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
      pendingResultsScrollRef.current = false;
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

  const handleCarrerInput = (value: string) => {
    setStreetNameLoading(false);
    setCarrerInput(value);
    setSelectedCarrer(null);
    setNumOptions([]);
    setNum('');
    clearTimeout(carrerTimerRef.current);
    carrerAbortRef.current?.abort();
    portalsAbortRef.current?.abort();
    ++selectedCarrerRequestIdRef.current;
    setNumLoading(false);
    setCarrerLoading(false);
    setCarrerSuggestions([]);
    const requestId = ++carrerRequestIdRef.current;

    if (value.trim().length < 3) {
      setCarrerSuggestions([]);
      return;
    }

    const normalizedValue = value.trim().toLocaleLowerCase('ca');
    const cached = geoBcnResponseRef.current;
    if (cached && normalizedValue === cached.query) {
      setCarrerSuggestions(cached.response.vies);
      return;
    }

    setCarrerLoading(true);
    carrerTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      carrerAbortRef.current = controller;
      const response = await searchCarrers(value.trim(), undefined, controller.signal);
      if (requestId !== carrerRequestIdRef.current) return;

      geoBcnResponseRef.current = { query: normalizedValue, response };
      setCarrerSuggestions(response.vies);
      setCarrerLoading(false);
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
    clearTimeout(carrerTimerRef.current);
    carrerAbortRef.current?.abort();
    ++carrerRequestIdRef.current;
    portalsAbortRef.current?.abort();
    const controller = new AbortController();
    portalsAbortRef.current = controller;
    setSelectedCarrer(via);
    setCarrerInput(via.nomComplet ?? via.nom);
    setCarrerLoading(false);
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
    requestAnimationFrame(() => numInputRef.current?.focus());
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
    pendingResultsScrollRef.current = false;
    clearTimeout(carrerTimerRef.current);
    carrerAbortRef.current?.abort();
    portalsAbortRef.current?.abort();
    ++carrerRequestIdRef.current;
    ++selectedCarrerRequestIdRef.current;
    setCarrerLoading(false);
    setNumLoading(false);
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
    <>
      <main className="" style={{ minHeight: '100vh' }}>

        <AppNavbar />

        <section id="seccio-introduccio" className='section-introdution'>
          <div className="container intro-container w-50">
            <h1 className="intro-title mb-5">apartament</h1>
            <p className="fs-4 text-gray-600 lh-base">
              L’Ajuntament de Barcelona va anunciar el passat mes de setembre que “a Barcelona, el 2028, s’eliminaran les llicències d’habitatges d’ús turístic”
            </p>
            <p className="text-gray-600">
              El departament d’<a href="https://ajuntament.barcelona.cat/urbanisme-accio-climatica-mobilitat-pla-barris-serveis-urbans/ca" target="_blank" rel="noopener noreferrer">Urbanisme, Acció Climàtica, Mobilitat, Pla de Barris i Serveis Urbans</a> ha publicat recentment una nova secció al seu portal web de l’Ajuntament per informar d’aquesta nova iniciativa politica del <a href="https://www.barcelona.cat/habitatge/ca/pla-viure/en-que-consisteix" target="_blank" rel="noopener noreferrer">pla “VIURE”</a>.
            </p>
          </div>
        </section>

        <section id="seccio-cerca" className='section-search'>
          <div className="container">
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
              carrerLoading={carrerLoading}
              numLoading={numLoading}
              numInputRef={numInputRef}
              searchButtonRef={searchButtonRef}
              onSubmit={handleSubmit}
              onCarrerInput={handleCarrerInput}
              onSelectCarrer={handleSelectCarrer}
              onNumChange={setNum}
              onCarrerBlur={() => setTouched((prev) => ({ ...prev, carrer: true }))}
              onNumBlur={() => setTouched((prev) => ({ ...prev, num: true }))}
              showReset={showResults}
              onHandleResetSearch={handleResetSearch}
            />

          </div>


          {/* <!-- end of the search form --> */}
        </section>

        <section id="seccio-resultats" ref={resultsSectionRef} className='bg-transparent'>
          {showResults && (
            <div className="search-results-container">
                <ApartmentResults
                  title={`${carrerDisplayName}${num ? `, ${num}` : ''}`.trim()}
                  streetName={carrerDisplayName}
                  addressGroups={results}
                  streetGroups={streetResults}
                  loading={loading || streetNameLoading}
                  onResetSearch={handleResetSearch}
                  onSelectAddress={handleSelectAddress}
                />
            </div>
          )}
        </section>

        <section id="seccio-about">
          <div className='container w-50'>
            <h1>Una eina ciutadana, amb context</h1>
            <p className="fs-5 text-gray-600 lh-base">
              El projecte acosta la informació pública sobre habitatges d&apos;ús turístic a una consulta quotidiana: què hi ha registrat a la meva finca i al meu entorn?
            </p>
            <div className="row gy-4 mt-2">
              <div className="col-12 col-md-4">
                <h2>Consulta local</h2>
                <p className="text-gray-600">Busca per carrer i número per revisar els registres associats a una adreça de Barcelona.</p>
              </div>
              <div className="col-12 col-md-4">
                <h2>Dades obertes</h2>
                <p className="text-gray-600">La informació es presenta a partir de registres públics i es relaciona amb el mapa dels barris.</p>
              </div>
              <div className="col-12 col-md-4">
                <h2>Lectura responsable</h2>
                <p className="text-gray-600">Les dades poden tenir mancances o desfasaments. No trobar un registre no és, per si sol, una determinació sobre la legalitat d&apos;un habitatge.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="seccio-mapa">
          <div className='map-container'>
            <MapComponent
            />
          </div>
        </section>

      </main>
      <CountdownBanner />
      <footer className="site-footer bg-white">
        <div className="container py-5">
          <div className="row g-4">
            <div className="col-12 col-md-5">
              <a className="site-footer__brand" href="#seccio-introduccio">El Guiri</a>
              <p className="site-footer__summary">
                Informació ciutadana sobre habitatges d&apos;ús turístic a Barcelona, a partir de dades obertes.
              </p>
            </div>

            <nav className="col-6 col-md-3" aria-label="Navegació del peu de pàgina">
              <h2 className="site-footer__heading">Explora</h2>
              <ul className="site-footer__links">
                <li><a href="#seccio-cerca">Cerca una adreça</a></li>
                <li><a href="#seccio-resultats">Resultats</a></li>
                <li><a href="#seccio-mapa">Mapa de Barcelona</a></li>
                <li><a href="#seccio-about">Sobre el projecte</a></li>
              </ul>
            </nav>

            <div className="col-6 col-md-4">
              <h2 className="site-footer__heading">Contacte</h2>
              <p className="site-footer__summary">Tens preguntes o vols compartir informació?</p>
              <a className="site-footer__link" href="mailto:contacte@elguiri.cat">contacte@elguiri.cat</a>
            </div>
          </div>

          <div className="site-footer__bottom">
            <span>&copy; 2026 El Guiri. Tots els drets reservats.</span>
            <div className="site-footer__legal" aria-label="Informació legal">
              <span>Avís legal</span>
              <span>Privacitat</span>
              <span>Accessibilitat</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

