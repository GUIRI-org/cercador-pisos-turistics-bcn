'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SEARCH_CARRERS_MAX_RESULTS, searchCarrers } from '@/lib/api';
import type { CarrerVia } from '@/lib/types';

export const MIN_STREET_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('ca')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// Mirrors the geoportal matcher: query words must be word prefixes, in order.
const matchesQuery = (via: CarrerVia, tokens: string[]) => {
  const words = normalize(via.nomComplet ?? `${via.tipusVia?.nom ?? ''} ${via.nom}`).split(' ');
  let i = 0;
  return tokens.every((token) => {
    while (i < words.length && !words[i].startsWith(token)) i++;
    return i++ < words.length;
  });
};

type Cache = { query: string; vies: CarrerVia[] };

/** Owns the street autocomplete state so keystrokes only re-render the component that uses it. */
export function useStreetSuggestions() {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<CarrerVia[]>([]);
  const [loading, setLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const cacheRef = useRef<Cache | null>(null);

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    abortRef.current?.abort();
    abortRef.current = null;
    ++requestIdRef.current;
    setLoading(false);
  }, []);

  useEffect(() => cancel, [cancel]);

  const reset = useCallback(
    (text = '') => {
      cancel();
      setInput(text);
      setSuggestions([]);
    },
    [cancel]
  );

  const onInputChange = useCallback(
    (value: string) => {
      setInput(value);
      cancel();

      const query = normalize(value);
      if (query.length < MIN_STREET_QUERY_LENGTH) {
        setSuggestions((prev) => (prev.length ? [] : prev));
        return;
      }

      // Any query that extends a cached one is a subset of its results.
      const cached = cacheRef.current;
      if (cached && query.startsWith(cached.query)) {
        const sameQuery = query === cached.query;
        const local = sameQuery ? cached.vies : cached.vies.filter((via) => matchesQuery(via, query.split(' ')));
        if (local.length > 0) {
          setSuggestions(local);
          if (sameQuery || cached.vies.length < SEARCH_CARRERS_MAX_RESULTS) return;
        }
      }

      const requestId = requestIdRef.current;
      setLoading(true);
      timerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        const { vies } = await searchCarrers(value.trim(), undefined, controller.signal);
        if (requestId !== requestIdRef.current) return;

        if (vies.length > 0) cacheRef.current = { query, vies };
        setSuggestions(vies);
        setLoading(false);
      }, DEBOUNCE_MS);
    },
    [cancel]
  );

  return { input, suggestions, loading, onInputChange, cancel, reset };
}
