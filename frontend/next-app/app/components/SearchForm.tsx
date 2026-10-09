'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import Select, { components } from 'react-select';
import type { InputProps, SelectInstance } from 'react-select';
import { FaCircleInfo } from 'react-icons/fa6';
import type { CarrerVia } from '@/lib/types';
import { MIN_STREET_QUERY_LENGTH, useStreetSuggestions } from '../hooks/useStreetSuggestions';

const MAX_RENDERED_STREETS = 50;

type NumberOption = { value: string; label: string };

function NumberInput(props: InputProps<NumberOption, false>) {
  return <components.Input {...props} accessKey="n" />;
}

function StreetInput(props: InputProps<CarrerVia, false>) {
  return <components.Input {...props} accessKey="c" inputMode="search" />;
}

const streetLabel = (via: CarrerVia) => via.nomComplet || `${via.tipusVia?.nom || ''} ${via.nom}`.trim();

interface SearchFormProps {
  /** Replaces the typed street text (deep links, reset); a new object always applies. */
  carrerSeed: { text: string };
  selectedCarrer: CarrerVia | null;
  num: string;
  numOptions: string[];
  carrerError: boolean | undefined;
  numError: boolean | undefined;
  canSearch: boolean;
  carrerInputRef: RefObject<SelectInstance<CarrerVia, false> | null>;
  numLoading: boolean;
  numInputRef: RefObject<SelectInstance<NumberOption, false> | null>;
  searchButtonRef: RefObject<HTMLButtonElement | null>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCarrerEdit: () => void;
  onSelectCarrer: (via: CarrerVia) => void;
  onNumChange: (value: string) => void;
  onCarrerBlur: () => void;
  onNumBlur: () => void;
}

export function SearchForm({
  carrerSeed,
  selectedCarrer,
  num,
  numOptions,
  carrerError,
  numError,
  canSearch,
  carrerInputRef,
  numLoading,
  numInputRef,
  searchButtonRef,
  onSubmit,
  onCarrerEdit,
  onSelectCarrer,
  onNumChange,
  onCarrerBlur,
  onNumBlur,
}: SearchFormProps) {
  const [showAccessKeysInfo, setShowAccessKeysInfo] = useState(false);
  const street = useStreetSuggestions();
  const { reset: resetStreet } = street;
  const streetOptions = useMemo(
    () => street.suggestions.slice(0, MAX_RENDERED_STREETS),
    [street.suggestions]
  );
  const numberOptions = useMemo(
    () => numOptions.map((number) => ({ value: number, label: number })),
    [numOptions]
  );

  useEffect(() => {
    resetStreet(carrerSeed.text);
  }, [carrerSeed, resetStreet]);

  return (
    <section id="seccio-cerca" className='section-search'>
      <form className="search-form container" onSubmit={onSubmit}>
        <div className="legend-row">
          {/* <span className="access-keys-info relative">
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
        </span> */}
          <legend>Consulta els habitatges</legend>
        </div>
        <div className="row">
          <p className="text-gray-600 italic">
            Omple les caselles. Si la teva adreça no hi apareix, el pis que busques és il·legal. (Per a habitatges de la ciutat de Barcelona.)
          </p>
          <div className="col-12 col-md-8 col-lg-7">
            <div className="label">
              <label htmlFor="carrerInp">
                Nom del <u>C</u>arrer: * <span className="visually-hidden">(Alt+C)</span>
              </label>
            </div>
            <div className="number-select">
              <Select<CarrerVia, false>
                inputId="carrerInp"
                instanceId="street-select"
                ref={carrerInputRef}
                classNamePrefix="number-select"
                components={{ Input: StreetInput }}
                options={streetOptions}
                getOptionLabel={streetLabel}
                getOptionValue={(via) => via.codi}
                filterOption={null}
                value={selectedCarrer}
                inputValue={selectedCarrer ? '' : street.input}
                isSearchable
                isClearable
                isLoading={street.loading}
                placeholder="Cerqueu un carrer"
                loadingMessage={() => 'Cercant carrers...'}
                noOptionsMessage={() => street.input.trim().length < MIN_STREET_QUERY_LENGTH ? `Escriviu almenys ${MIN_STREET_QUERY_LENGTH} caràcters` : 'No hi ha carrers coincidents'}
                aria-required="true"
                aria-invalid={carrerError}
                aria-describedby={carrerError ? 'error-address' : undefined}
                onInputChange={(value, action) => {
                  if (action.action !== 'input-change') return;
                  street.onInputChange(value);
                  onCarrerEdit();
                }}
                onChange={(via) => {
                  if (via) {
                    street.cancel();
                    onSelectCarrer(via);
                  } else {
                    street.reset();
                    onCarrerEdit();
                  }
                }}
                onBlur={onCarrerBlur}
              />
              {carrerError && (
                <span id="error-address" className="error-msg" role="status">
                  Aquest camp és obligatori
                </span>
              )}
            </div>
          </div>

          <div className="col-12 col-md-4 col-lg-3">
            <div className="label">
              <label htmlFor="numInp">
                <u>N</u>úm: * <span className="visually-hidden">(Alt+N)</span>
              </label>
            </div>
            <div className="number-select">
              <Select<NumberOption, false>
                key={selectedCarrer?.codi ?? 'no-street'}
                inputId="numInp"
                instanceId="number-select"
                ref={numInputRef}
                classNamePrefix="number-select"
                components={{ Input: NumberInput }}
                options={numberOptions}
                value={num ? { value: num, label: num } : null}
                isDisabled={!selectedCarrer || numOptions.length === 0}
                isLoading={numLoading}
                isSearchable
                isClearable
                placeholder="1"
                noOptionsMessage={() => 'No hi ha números coincidents'}
                aria-required="true"
                aria-invalid={numError}
                aria-describedby={numError ? 'error-number' : undefined}
                onChange={(option) => onNumChange(option?.value ?? '')}
                onBlur={onNumBlur}
              />
              {numError && (
                <span id="error-number" className="error-msg" role="status">
                  Aquest camp és obligatori
                </span>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-2">
            <div className="label d-none d-lg-block">
              <label>&nbsp;</label>
            </div>
            <div className="d-flex gap-2 w-100 mt-3 mt-lg-0">
              <button
                ref={searchButtonRef}
                type="submit"
                className="btn btn-dark py-3 w-100"
                accessKey="s"
                title="Cerca (Alt+S)"
                disabled={!canSearch}
              >
                Cerca
              </button>
            </div>
          </div>
        </div>

      </form>
    </section>
  );
}
