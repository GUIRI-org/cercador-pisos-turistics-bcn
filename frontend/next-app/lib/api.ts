import {
  TerritoriResponse,
  TipusVia,
  CarrerVia,
  AdrecaSearchResult,
  ApartmentSearchResponse,
  AddressGroup,
} from './types';

const BASE = 'https://geoportal.barcelona.cat/geoBCN/serveis/territori';
const GUIRI_API_BASE = 'http://127.0.0.1:9092';

// Barcelona Territory API calls
export async function fetchTipusVies(): Promise<TipusVia[]> {
  try {
    const res = await fetch(`${BASE}/tipusvies`);
    const json = (await res.json()) as TerritoriResponse;
    return (json.resultats?.tipusvies || []).sort((a, b) =>
      a.nom.localeCompare(b.nom, 'ca')
    );
  } catch {
    return [];
  }
}

export async function searchCarrers(
  query: string,
  tipusAbr?: string
): Promise<{ vies: CarrerVia[]; adreces: AdrecaSearchResult[] }> {
  try {
    const searchQuery = tipusAbr ? `${tipusAbr} ${query}` : query;
    const res = await fetch(`${BASE}?q=${encodeURIComponent(searchQuery)}`);
    const json = (await res.json()) as TerritoriResponse;
    return {
      vies: json.resultats?.vies || [],
      adreces: json.resultats?.adreces || [],
    };
  } catch {
    return { vies: [], adreces: [] };
  }
}

// GUIRI Internal API calls
export async function searchApartments(params: {
  carrer?: string;
  num1?: string | number | null;
  tipus_carrer?: string | null;
}): Promise<AddressGroup[]> {
  try {
    const qs = new URLSearchParams();
    if (params.carrer) qs.set('carrer', params.carrer);
    if (params.num1 !== undefined && params.num1 !== null && params.num1 !== '')
      qs.set('num1', String(params.num1));
    if (params.tipus_carrer) qs.set('tipus_carrer', params.tipus_carrer);

    const url = `${GUIRI_API_BASE}/api/v1/apartments/search?${qs}`;
    const res = await fetch(url);
    const json = (await res.json()) as ApartmentSearchResponse;
    return json?.data || [];
  } catch {
    return [];
  }
}
