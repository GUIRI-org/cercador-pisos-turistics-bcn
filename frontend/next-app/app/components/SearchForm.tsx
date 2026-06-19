'use client';

import { useEffect, useState, useRef } from 'react';
import { searchCarrers } from '@/lib/api';
import { CarrerVia, AdrecaSearchResult } from '@/lib/types';

export interface SelectedStreetInfo {
  codi: string;
  nom: string;
  nomComplet?: string;
  tipusViaNom?: string;
  tipusViaCodi?: string;
  availableNumbers: number;
}

interface SearchFormProps {
  onSearch: (
    carrer: string,
    tipusCarrer: string | null,
    num1: string | null,
    selectedStreetInfo: SelectedStreetInfo
  ) => void;
}

export function SearchForm({ onSearch }: SearchFormProps) {
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

  // Handle carrer input with debounce
  const handleCarrerInput = (value: string) => {
    setCarrerInput(value);
    setSelectedCarrer(null);
    setNumInput('');
    setNumOptions([]);
    clearTimeout(carrerTimerRef.current);

    if (value.trim().length < 2) {
      setShowSuggestions(false);
      return;
    }

    carrerTimerRef.current = setTimeout(async () => {
      const { vies, adreces } = await searchCarrers(value);

      const filtered = vies;

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
    const tipusCarrer = selectedCarrer?.tipusVia?.nom || null;
    const num1 = numInput.trim() || null;
    const selectedStreetInfo: SelectedStreetInfo = {
      codi: selectedCarrer.codi,
      nom: selectedCarrer.nom,
      nomComplet: selectedCarrer.nomComplet,
      tipusViaNom: selectedCarrer.tipusVia?.nom,
      tipusViaCodi: selectedCarrer.tipusVia?.codi,
      availableNumbers: numOptions.length,
    };

    onSearch(carrerNom, tipusCarrer, num1, selectedStreetInfo);
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
    <div className="form-container d-flex flex-column flex-md-row gap-1 gap-md-2 bg-warning p-1 p-md-2 rounded" style={{ minWidth: 0 }}>
      <div className="form-floating flex-md-grow-1" style={{ minWidth: 0 }}>

        <input
          ref={carrerInputRef}
          id="carrer"
          type="text"
          value={carrerInput}
          onChange={(e) => handleCarrerInput(e.target.value)}
          onFocus={() => carrerInput.trim().length >= 2 && setShowSuggestions(true)}
          placeholder="Type street…"
          className="form-control border-none"
          style={{ fontSize: '0.95rem' }}
        />

        {showSuggestions && (
          <ul
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 z-10 border border-gray-300 border-t-0 bg-white"
          >
            {carrerSuggestions.length === 0 ? (
              <li className="px-3 py-2 text-gray-500">No street found</li>
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

        <label htmlFor="carrer" className="d-none d-md-block">Street <span className="text-red-500">*</span></label>
        <label htmlFor="carrer" className="d-md-none" style={{ fontSize: '0.85rem' }}>Street <span className="text-red-500">*</span></label>
      </div>

      <div className="form-floating" style={{ minWidth: 0 }}>

        <input
          id="num"
          type="number"
          value={numInput}
          onChange={handleNumChange}
          disabled={!selectedCarrer}
          placeholder="–"
          list="num-list"
          className="form-control border-none"
          style={{ width: '100%', fontSize: '0.95rem' }}
        />
        <datalist id="num-list">
          {numOptions.map((num) => (
            <option key={num} value={num} />
          ))}
        </datalist>

        <label htmlFor="num" className="d-none d-md-block">Number <span className="text-red-500">*</span></label>
        <label htmlFor="num" className="d-md-none" style={{ fontSize: '0.85rem' }}>Nº <span className="text-red-500">*</span></label>
      </div>

      <button
        onClick={handleSearch}
        disabled={!selectedCarrer || !numInput.trim()}
        className="btn btn-secondary"
        style={{  }}
        title="Search"
      >
        Search
      </button>
    </div>

  );
}
