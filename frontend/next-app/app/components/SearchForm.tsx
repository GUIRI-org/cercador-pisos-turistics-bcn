'use client';

import type { RefObject } from 'react';
import type { CarrerVia } from '@/lib/types';

interface SearchFormProps {
  carrerInput: string;
  carrerSuggestions: CarrerVia[];
  selectedCarrer: CarrerVia | null;
  num: string;
  numOptions: string[];
  carrerError: boolean | undefined;
  numError: boolean | undefined;
  canSearch: boolean;
  carrerInputRef: RefObject<HTMLInputElement | null>;
  numInputRef: RefObject<HTMLSelectElement | null>;
  searchButtonRef: RefObject<HTMLButtonElement | null>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCarrerInput: (value: string) => void;
  onSelectCarrer: (codi: string) => void;
  onNumChange: (value: string) => void;
  onCarrerKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onNumKeyDown: (event: React.KeyboardEvent<HTMLSelectElement>) => void;
  onCarrerBlur: () => void;
  onNumBlur: () => void;
}

export function SearchForm({
  carrerInput,
  carrerSuggestions,
  selectedCarrer,
  num,
  numOptions,
  carrerError,
  numError,
  canSearch,
  carrerInputRef,
  numInputRef,
  searchButtonRef,
  onSubmit,
  onCarrerInput,
  onSelectCarrer,
  onNumChange,
  onCarrerKeyDown,
  onNumKeyDown,
  onCarrerBlur,
  onNumBlur,
}: SearchFormProps) {
  return (
    <form className="search-form container p-5 border bg-white" onSubmit={onSubmit}>
      <fieldset className="d-flex flex-wrap gap-3">
        <legend>Adreça</legend>
        <div className="carrer flex-fill">
          <div className="label">
            <label htmlFor="carrerInp">
              Nom del <u>C</u>arrer: * <span className="visually-hidden">(Alt+C)</span>
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
              onChange={(event) => onCarrerInput(event.target.value)}
              onKeyDown={onCarrerKeyDown}
              onBlur={onCarrerBlur}
            />
            {carrerInput.trim().length >= 4 && !selectedCarrer && carrerSuggestions.length > 0 && (
              <ul className="carrer-suggestions">
                {carrerSuggestions.map((via) => (
                  <li
                    key={via.codi}
                    tabIndex={0}
                    role="button"
                    onMouseDown={() => onSelectCarrer(via.codi)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectCarrer(via.codi);
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
            <select
              id="numInp"
              ref={numInputRef}
              className="w-full"
              value={num}
              disabled={!selectedCarrer || numOptions.length === 0}
              accessKey="n"
              aria-required="true"
              aria-invalid={numError}
              aria-describedby="error-number"
              onChange={(event) => onNumChange(event.target.value)}
              onKeyDown={onNumKeyDown}
              onBlur={onNumBlur}
            >
              <option value="">Seleccioneu un número</option>
              {numOptions.map((number) => (
                <option key={number} value={number}>{number}</option>
              ))}
            </select>
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
  );
}
