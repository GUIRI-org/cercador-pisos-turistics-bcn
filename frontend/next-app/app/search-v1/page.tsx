'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import { fetchTipusVies, searchApartments, searchCarrers } from '@/lib/api';
import { AddressGroup, CarrerVia, TipusVia } from '@/lib/types';
import { AppNavbar } from '../components/AppNavbar';
import { ApartmentResults } from '../components/ApartmentResults';
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

// Geoportal street names don't always match how they're stored in the GUIRI DB — add exceptions here as they're found.
const CARRER_NAME_OVERRIDES: Record<string, string> = {
  'PARAL·LEL': 'PARAL.LEL',
};

const normalizeCarrerForApi = (carrer: string): string => {
  const upper = carrer.trim().toUpperCase();
  return CARRER_NAME_OVERRIDES[upper] ?? carrer;
};

export default function SearchV1Page() {
  const [tipusVies, setTipusVies] = useState<TipusVia[]>([]);
  const [tipusVia, setTipusVia] = useState('');

  const [carrerInput, setCarrerInput] = useState('');
  const [carrerSuggestions, setCarrerSuggestions] = useState<CarrerVia[]>([]);
  const [selectedCarrer, setSelectedCarrer] = useState<CarrerVia | null>(null);
  const [numOptions, setNumOptions] = useState<string[]>([]);
  const [num, setNum] = useState('');
  const [floor, setFloor] = useState('');
  const [stair, setStair] = useState('');
  const [door, setDoor] = useState('');

  const [touched, setTouched] = useState<{ carrer?: boolean; num?: boolean }>({});
  const [results, setResults] = useState<AddressGroup[]>([]);
  const [streetResults, setStreetResults] = useState<AddressGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const carrerTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const storedAdrecesRef = useRef<{ carrerCodi: string; numeracioPostal: string }[]>([]);

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

  const handleSearch = useCallback(() => {
    setTouched({ carrer: true, num: true });
    if (!selectedCarrer || !num) return;

    setLoading(true);
    setShowResults(true);

    const tipusCarrer = selectedCarrer.tipusVia?.nom || null;
    const carrer = normalizeCarrerForApi(selectedCarrer.nom);

    Promise.all([
      searchApartments({ carrer, tipus_carrer: tipusCarrer, num1: num }),
      searchApartments({ carrer, tipus_carrer: tipusCarrer }),
    ])
      .then(([exact, street]) => {
        setResults(exact);
        setStreetResults(street);
      })
      .catch(() => {
        setResults([]);
        setStreetResults([]);
      })
      .finally(() => setLoading(false));
  }, [selectedCarrer, num]);

  const filteredStreetResults = useMemo(() => {
    if (!results.length) return streetResults;

    const exactAddressKeys = new Set(results.map(getAddressGroupKey));
    return streetResults.filter((group) => !exactAddressKeys.has(getAddressGroupKey(group)));
  }, [results, streetResults]);

  const streetTotalNumbers = useMemo(
    () => new Set(streetResults.map((group) => group.num1).filter((n) => n !== undefined && n !== null)).size,
    [streetResults]
  );

  return (

    <main className="container-fluid" style={{ minHeight: '100vh', paddingTop: '1rem', paddingBottom: '1rem' }}>
      <div className="container">
        <AppNavbar secondaryHref="/search-v2" secondaryLabel="Search v2" />
        <h1 className="">Habitatges d'ús turístic</h1>
        <h2 className="">Consulta els habitatges que tenen llicència</h2>
        <p className="mt-2">
          Detecta fàcilment si a la teva finca hi ha habitatges d'ús turístic sense llicència, o si creus que pots estar allotjat en un d'ells.
        </p>

        <div className="caracteristicas-form mt-3">
          <p className="text-gray-600 italic">
            Omple les caselles. Si la teva adreça no hi apareix, el pis que busques és il·legal. (Per a habitatges de la ciutat de Barcelona.)
          </p>
          <div className="p-5">
            <div className="row">
              <div className="col col-auto tipusVia1">
                <div className="label">
                  <label htmlFor="tipusViaInp">Tipus Via:</label>
                </div>
                <div className="input">
                  <select
                    id="tipusViaInp"
                    className="w-full"
                    value={tipusVia}
                    onChange={(e) => setTipusVia(e.target.value)}
                  >
                    <option value="">Qualsevol</option>
                    {tipusVies.map((tv, e) => (
                      <option key={e + "-" + tv.codi} value={tv.abreviatura}>
                        {tv.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="col carrer">
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

              <div className="col col-auto numero">
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
              <div className="col justify-content-end col-auto">
                <div className="label">
                  <label>&nbsp;</label>
                </div>
                <button type="button" className="btn btn-primary" onClick={handleSearch}>
                  Cerca
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showResults && (
        <div className="mt-6 search-results" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <ApartmentResults
            title={`${selectedCarrer?.tipusVia?.nom ? `${selectedCarrer.tipusVia.nom} ` : ''}${selectedCarrer?.nom || ''}${num ? `, ${num}` : ''}`.trim()}
            addressGroups={results}
            loading={loading}
          />

          {(loading || filteredStreetResults.length > 0) && (
            <ApartmentResults
              title={`Mateix carrer (${filteredStreetResults.length} adreces · ${streetTotalNumbers} números)`}
              addressGroups={filteredStreetResults}
              loading={loading}
            />
          )}
        </div>
      )}
    </main>
  );
}

