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
  }, []);

  return (

    <main className="" style={{ minHeight: '100vh' }}>

      <AppNavbar secondaryHref="/search-v1" secondaryLabel="Search v1" />

      <div className="container d-flex flex-column p-5">
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
      <div ref={searchSectionRef} className={`mb-5 bg-white ${showResults ? ' search-section--sticky' : ''}`}>
        <div className="container d-flex flex-column gap-3 p-5 border bg-white">
          <div className="search-form">
            <div className="d-flex flex-wrap gap-3 align-items-end">

              <div className="carrer flex-fill">
                <div className="label">
                  <label htmlFor="carrerInp">Carrer: *</label>
                </div>
                <div className="input relative">
                  <input
                    id="carrerInp"
                    type="text"
                    className="w-full"
                    autoComplete="off"
                    placeholder="Seleccioneu una opció"
                    value={carrerInput}
                    aria-required="true"
                    aria-invalid={carrerError}
                    aria-describedby="error-address"
                    onChange={(e) => handleCarrerInput(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, carrer: true }))}
                  />
                  {carrerInput.trim().length >= 2 && !selectedCarrer && carrerSuggestions.length > 0 && (
                    <ul className="carrer-suggestions">
                      {carrerSuggestions.map((via) => (
                        <li key={via.codi} onMouseDown={() => handleSelectCarrer(via.codi)}>
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
                  <label htmlFor="numInp">Núm: *</label>
                </div>

                <div className="input">
                  {/* Geoportal's search endpoint caps results at 25 matches, so it can't reliably
                    preload every number for a street — a free-text field lets users enter any number. */}
                  <input
                    id="numInp"
                    type="text"
                    className="w-full"
                    list="num-list"
                    autoComplete="off"
                    value={num}
                    disabled={!selectedCarrer}
                    aria-required="true"
                    aria-invalid={numError}
                    aria-describedby="error-number"
                    onChange={(e) => setNum(e.target.value)}
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

              <div className="search-button">
                <button type="button" className="btn btn-primary" onClick={handleSearch} disabled={!canSearch}>
                  Cerca
                </button>
              </div>


            </div>
          </div>
        </div>
      </div>
      {showResults && (
        <div className="bg-light mt-5">
          <div className="container search-results-container d-flex flex-column gap-4 p-5">
            <button type="button" className="btn btn-outline-secondary ms-auto" onClick={handleResetSearch}>
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
      <div className='map-container'>
        <MapComponent
          points={results.flatMap((group): ChoroplethPoint[] => {
            if (group.longitud_x === undefined || group.latitud_y === undefined) return [];
            return [{ longitude: group.longitud_x, latitude: group.latitud_y, label: group.address }];
          })}
        />
      </div>
    </main>
  );
}

