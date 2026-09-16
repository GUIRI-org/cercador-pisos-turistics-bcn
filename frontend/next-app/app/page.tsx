'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import { fetchTipusVies, searchApartments, searchCarrers } from '@/lib/api';
import { AddressGroup, CarrerVia, TipusVia } from '@/lib/types';
import { AppNavbar } from './components/AppNavbar';
import { ApartmentResults } from './components/ApartmentResults';
import { MapComponent } from './components/MapComponent';
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
  const [showResults, setShowResults] = useState(false);

  const carrerTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const storedAdrecesRef = useRef<{ carrerCodi: string; numeracioPostal: string }[]>([]);
  const searchSectionRef = useRef<HTMLDivElement | null>(null);
  const carrerInputRef = useRef<HTMLInputElement | null>(null);
  const numInputRef = useRef<HTMLInputElement | null>(null);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    fetchTipusVies().then(setTipusVies);
  }, []);

  const handleCarrerInput = (value: string) => {
    setCarrerInput(value);
    setSelectedCarrer(null);
    setNumOptions([]);
    setNum('');
    clearTimeout(carrerTimerRef.current);

    if (value.trim().length < 2) {
      setCarrerSuggestions([]);
      return;
    }

    carrerTimerRef.current = setTimeout(async () => {
      const { vies, adreces } = await searchCarrers(value, tipusVia || undefined);
      setCarrerSuggestions(vies);
      storedAdrecesRef.current = adreces.map((a) => ({
        carrerCodi: a.carrer?.codi,
        numeracioPostal: a.numeracioPostal,
      }));
    }, 300);
  };

  const handleSelectCarrer = (codi: string) => {
    const via = carrerSuggestions.find((v) => v.codi === codi) || null;
    setSelectedCarrer(via);
    setCarrerInput(via?.nomComplet || via?.nom || '');
    setTouched((prev) => ({ ...prev, carrer: true }));

    if (!via) {
      setNumOptions([]);
      return;
    }

    const nums = [...new Set(
      storedAdrecesRef.current
        .filter((a) => a.carrerCodi === via.codi)
        .map((a) => a.numeracioPostal)
    )]
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        return !isNaN(na) && !isNaN(nb) ? na - nb : a.localeCompare(b, 'ca');
      });

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

  const handleNumKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    setTouched((prev) => ({ ...prev, num: true }));
    if (num.trim()) searchButtonRef.current?.focus();
  };

  const carrerError = touched.carrer && !selectedCarrer;
  const numError = touched.num && !num;
  const canSearch = Boolean(selectedCarrer) && num.trim().length > 0;

  const handleSearch = useCallback(() => {
    setTouched({ carrer: true, num: true });
    if (!selectedCarrer || !num) return;

    setLoading(true);
    setShowResults(true);

    // Wait for the results block to render so its position accounts for the sticky form.
    requestAnimationFrame(() => {
      const sectionTop = searchSectionRef.current?.getBoundingClientRect().top ?? 0;
      window.scrollTo({ top: window.scrollY + sectionTop, behavior: 'smooth' });
    });

    const tipusCarrer = selectedCarrer.tipusVia?.nom || null;
    const carrer = normalizeCarrerForApi(selectedCarrer.nom);

    Promise.all([
      searchApartments({ carrer, tipus_carrer: tipusCarrer, num1: num }),
      searchApartments({ carrer, tipus_carrer: tipusCarrer }),
    ])
      .then(([exact, street]) => {
        setResults(filterGroupsByUnit(exact, { escala, pis, porta }));
        setStreetResults(street);
      })
      .catch(() => {
        setResults([]);
        setStreetResults([]);
      })
      .finally(() => setLoading(false));
  }, [selectedCarrer, num, escala, pis, porta]);

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
    requestAnimationFrame(() => carrerInputRef.current?.focus());
  }, []);

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
          <div ref={searchSectionRef} className={`${showResults ? ' search-section--sticky' : ''}`}>
            <form className="search-form container p-5 border bg-white" onSubmit={handleSubmit}>
              <fieldset className="d-flex flex-wrap gap-3">
                <legend>Cerca l'habitatge per adreça</legend>
                <div className="carrer flex-fill">
                  <div className="label">
                    <label htmlFor="carrerInp">
                      <u>C</u>arrer: * <span className="visually-hidden">(Alt+C)</span>
                    </label>
                  </div>
                  <div className="input relative">
                    <input
                      id="carrerInp"
                      ref={carrerInputRef}
                      type="text"
                      className="w-full"
                      autoComplete="off"
                      placeholder="Seleccioneu una opció"
                      value={carrerInput}
                      accessKey="c"
                      aria-required="true"
                      aria-invalid={carrerError}
                      aria-describedby="error-address"
                      onChange={(e) => handleCarrerInput(e.target.value)}
                      onKeyDown={handleCarrerKeyDown}
                      onBlur={() => setTouched((prev) => ({ ...prev, carrer: true }))}
                    />
                    {carrerInput.trim().length >= 2 && !selectedCarrer && carrerSuggestions.length > 0 && (
                      <ul className="carrer-suggestions">
                        {carrerSuggestions.map((via) => (
                          <li
                            key={via.codi}
                            tabIndex={0}
                            role="button"
                            onMouseDown={() => handleSelectCarrer(via.codi)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleSelectCarrer(via.codi);
                              }
                            }}
                          >
                            {via.nomComplet || `${via.tipusVia?.nom || ''} ${via.nom}`}
                          </li>
                        ))}
                      </ul>
                    )}
                    {carrerError && (
                      <span id="error-address" className="error-msg" role="status">
                        Aquest camp és obligatori
                      </span>
                    )}
                  </div>
                </div>

                <div className="numero">
                  <div className="label">
                    <label htmlFor="numInp">
                      <u>N</u>úm: * <span className="visually-hidden">(Alt+N)</span>
                    </label>
                  </div>

                  <div className="input">
                    {/* Geoportal's search endpoint caps results at 25 matches, so it can't reliably
                      preload every number for a street — a free-text field lets users enter any number. */}
                    <input
                      id="numInp"
                      ref={numInputRef}
                      type="text"
                      className="w-full"
                      list="num-list"
                      autoComplete="off"
                      value={num}
                      disabled={!selectedCarrer}
                      accessKey="n"
                      aria-required="true"
                      aria-invalid={numError}
                      aria-describedby="error-number"
                      onChange={(e) => setNum(e.target.value)}
                      onKeyDown={handleNumKeyDown}
                      onBlur={() => setTouched((prev) => ({ ...prev, num: true }))}
                    />
                    <datalist id="num-list">
                      {numOptions.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                    {numError && (
                      <span id="error-number" className="error-msg" role="status">
                        Aquest camp és obligatori
                      </span>
                    )}
                  </div>
                </div>

                <div className="search-button d-flex align-items-end">
                  <button
                    ref={searchButtonRef}
                    type="submit"
                    className="btn btn-primary"
                    accessKey="s"
                    title="Cerca (Alt+S)"
                    disabled={!canSearch}
                  >
                    Cerca
                  </button>
                </div>

              </fieldset>
            </form>
          </div>
        </div>
        {showResults && (
          <div className="bg-white border-top search-results-container">
            <div className="container d-flex flex-column gap-4 p-5">
              <button
                type="button"
                className="btn btn-outline-secondary ms-auto"
                accessKey="e"
                title="Esborrar (Alt+E)"
                onClick={handleResetSearch}
              >
                Esborrar
              </button>
              <ApartmentResults
                title={`${selectedCarrer?.tipusVia?.nom ? `${selectedCarrer.tipusVia.nom} ` : ''}${selectedCarrer?.nom || ''}${num ? `, ${num}` : ''}`.trim()}
                addressGroups={results}
                streetGroups={streetResults}
                loading={loading}
                onResetSearch={handleResetSearch}
                singleResult={results.length === 1}
              />
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

