'use client';

import { useState } from 'react';
import type { RefObject } from 'react';
import { FaArrowRotateLeft, FaCircleInfo } from 'react-icons/fa6';
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
  showReset: boolean;
  onHandleResetSearch: () => void;
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
  showReset,
  onHandleResetSearch,
}: SearchFormProps) {
  const [showAccessKeysInfo, setShowAccessKeysInfo] = useState(false);

  return (
    <form className="search-form container p-5 border" onSubmit={onSubmit}>
      <div className="legend-row">
        <legend>Adreça</legend>
        <span className="access-keys-info relative">
          <button
            type="button"
            className="access-keys-info-trigger"
            aria-label="Informació sobre les tecles d'accés ràpid"
            aria-expanded={showAccessKeysInfo}
            aria-describedby="access-keys-popover"
            onMouseEnter={() => setShowAccessKeysInfo(true)}
            onMouseLeave={() => setShowAccessKeysInfo(false)}
            onFocus={() => setShowAccessKeysInfo(true)}
            onBlur={() => setShowAccessKeysInfo(false)}
            onClick={() => setShowAccessKeysInfo((prev) => !prev)}
          >
            <FaCircleInfo className='fs-1' aria-hidden="true" />
          </button>
          {showAccessKeysInfo && (
            <span id="access-keys-popover" role="tooltip" className="access-keys-popover access-keys-popover--left">
              Tecles d&apos;accés ràpid: <u>C</u>arrer (Alt+C), <u>N</u>úm (Alt+N), <u>Cerca</u>r (Alt+S) i <u>E</u>sborrar (Alt+E).
              En alguns navegadors cal combinar-les amb Shift (p. ex. Alt+Shift+C a Firefox/Chrome).
            </span>
          )}
        </span>
      </div>
      <div className="row">

        <div className="col-12 col-sm-6 col-md-7 mb-3">
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
            {carrerInput.trim().length >= 3 && !selectedCarrer && carrerSuggestions.length > 0 && (
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

        <div className="col-12 col-sm-4 col-md-2 mb-3">
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

        <div className="col-12 col-sm-2">
          <div className="label">
            <label>&nbsp;</label>
          </div>
          <div className="d-flex gap-2">
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
            {showReset && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                accessKey="e"
                title="Esborrar (Alt+E)"
                aria-label="Esborrar (Alt+E)"
                onClick={onHandleResetSearch}
              >
                <FaArrowRotateLeft aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

    </form>
  );
}
