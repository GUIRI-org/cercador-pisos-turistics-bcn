'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchTipusVies, searchCarrers } from '@/lib/api';
import { TipusVia, CarrerVia, AdrecaSearchResult } from '@/lib/types';

interface SearchFormProps {
  onSearch: (carrer: string, tipusCarrer: string | null, num1: string | null) => void;
}

export function SearchForm({ onSearch }: SearchFormProps) {
  const [tipusVies, setTipusVies] = useState<TipusVia[]>([]);
  const [selectedTipus, setSelectedTipus] = useState('');
  const [selectedTipusNom, setSelectedTipusNom] = useState<string | null>(null);

  const [carrerInput, setCarrerInput] = useState('');
  const [carrerSuggestions, setCarrerSuggestions] = useState<CarrerVia[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCarrer, setSelectedCarrer] = useState<CarrerVia | null>(null);
  const [storedAdreces, setStoredAdreces] = useState<AdrecaSearchResult[]>([]);
  const carrerTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const carrerInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  const [numInput, setNumInput] = useState('');
  const [numOptions, setNumOptions] = useState<string[]>([]);

  // Load tipus vies on mount
  useEffect(() => {
    fetchTipusVies().then(setTipusVies);
  }, []);

  // Handle tipus change
  const handleTipusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const codi = e.target.value;
    setSelectedTipus(codi);
    const selected = tipusVies.find((t) => t.codi === codi);
    setSelectedTipusNom(selected?.nom || null);
    setCarrerInput('');
    setCarrerSuggestions([]);
    setShowSuggestions(false);
    setSelectedCarrer(null);
    setNumInput('');
    setNumOptions([]);
  };

  // Handle carrer input with debounce
  const handleCarrerInput = (value: string) => {
    setCarrerInput(value);
    clearTimeout(carrerTimerRef.current);

    if (value.trim().length < 2) {
      setShowSuggestions(false);
      return;
    }

    carrerTimerRef.current = setTimeout(async () => {
      const { vies, adreces } = await searchCarrers(
        value,
        selectedTipus ? tipusVies.find((t) => t.codi === selectedTipus)?.abreviatura : undefined
      );

      const filtered = selectedTipus
        ? vies.filter((v) => !selectedTipus || v.tipusVia?.codi === selectedTipus)
        : vies;

      setCarrerSuggestions(filtered);
      setStoredAdreces(adreces);
      setShowSuggestions(true);
    }, 300);
  };

  // Handle carrer selection
  const handleSelectCarrer = (via: CarrerVia) => {
    const display = via.nomComplet || `${via.tipusVia?.nom || ''} ${via.nom}`;
    setCarrerInput(display);
    setSelectedCarrer(via);
    setShowSuggestions(false);
    populateNumbers(via.codi);
  };

  // Populate numbers for selected carrer
  const populateNumbers = (viaCodi: string) => {
    const viaAdreces = storedAdreces.filter((a) => a.carrer?.codi === viaCodi);
    const nums = [...new Set(viaAdreces.map((a) => a.numeracioPostal))]
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        return !isNaN(na) && !isNaN(nb)
          ? na - nb
          : a.localeCompare(b, 'ca');
      });
    setNumOptions(nums);
    setNumInput('');
  };

  // Handle number input change
  const handleNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNumInput(e.target.value);
  };

  // Handle search submission
  const handleSearch = () => {
    if (!selectedCarrer || !numInput.trim()) {
      return;
    }

    const carrerNom = selectedCarrer?.nom || carrerInput.trim();
    const tipusCarrer = selectedCarrer?.tipusVia?.nom || selectedTipusNom || null;
    const num1 = numInput.trim() || null;

    onSearch(carrerNom, tipusCarrer, num1);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        carrerInputRef.current &&
        !carrerInputRef.current.contains(e.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-lg">
      <div>
        <label htmlFor="tipus" className="block text-sm font-medium text-gray-700">
          Tipo Vía
        </label>
        <select
          id="tipus"
          value={selectedTipus}
          onChange={handleTipusChange}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        >
          <option value="">Seleccione una opción</option>
          {tipusVies.map((t) => (
            <option key={t.codi} value={t.codi}>
              {t.abreviatura} – {t.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <label htmlFor="carrer" className="block text-sm font-medium text-gray-700">
          Calle <span className="text-red-500">*</span>
        </label>
        <input
          ref={carrerInputRef}
          id="carrer"
          type="text"
          value={carrerInput}
          onChange={(e) => handleCarrerInput(e.target.value)}
          onFocus={() => carrerInput.trim().length >= 2 && setShowSuggestions(true)}
          placeholder="Escriu el nom del carrer…"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
        />

        {showSuggestions && (
          <ul
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 z-10 border border-gray-300 border-t-0 bg-white"
          >
            {carrerSuggestions.length === 0 ? (
              <li className="px-3 py-2 text-gray-500">Cap carrer trobat</li>
            ) : (
              carrerSuggestions.map((via) => (
                <li
                  key={via.codi}
                  onClick={() => handleSelectCarrer(via)}
                  className="cursor-pointer px-3 py-2 hover:bg-blue-50"
                >
                  {via.nomComplet || `${via.tipusVia?.nom || ''} ${via.nom}`}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div>
        <label htmlFor="num" className="block text-sm font-medium text-gray-700">
          Número <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="num"
            type="text"
            value={numInput}
            onChange={handleNumChange}
            disabled={!selectedCarrer}
            placeholder="–"
            list="num-list"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
          />
          <datalist id="num-list">
            {numOptions.map((num) => (
              <option key={num} value={num} />
            ))}
          </datalist>
          <button
            onClick={handleSearch}
            disabled={!selectedCarrer || !numInput.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            Cercar
          </button>
        </div>
      </div>
    </div>
  );
}
