import {
  TerritoriResponse,
  CarrerVia,
  AdrecaSearchResult,
  ApartmentSearchResponse,
  AddressGroup,
  DistrictListResponse,
  DistrictStat,
  NeighborhoodListResponse,
  NeighborhoodStat,
} from './types';

const BASE = 'https://geoportal.barcelona.cat/geoBCN/serveis/territori';
const GUIRI_API_BASE = process.env.NEXT_PUBLIC_GUIRI_API_BASE || 'http://127.0.0.1:9092';

// The territori search endpoint defaults to 25 results per array (vies/adreces); `max` raises that cap.
export const SEARCH_CARRERS_MAX_RESULTS = 200;

export async function searchCarrers(
  query: string,
  tipusAbr?: string,
  signal?: AbortSignal
): Promise<{ vies: CarrerVia[]; adreces: AdrecaSearchResult[] }> {
  try {
    const searchQuery = tipusAbr ? `${tipusAbr} ${query}` : query;
    const res = await fetch(`${BASE}?q=${encodeURIComponent(searchQuery)}&max=${SEARCH_CARRERS_MAX_RESULTS}`, { signal });
    const json = (await res.json()) as TerritoriResponse;
    return {
      vies: json.resultats?.vies || [],
      adreces: json.resultats?.adreces || [],
    };
  } catch {
    return { vies: [], adreces: [] };
  }
}

export async function fetchPortalsByVia(codi: string, signal?: AbortSignal): Promise<AdrecaSearchResult[]> {
  try {
    const res = await fetch(`${BASE}/portals?id_via=${encodeURIComponent(codi)}`, { signal });
    const json = (await res.json()) as { resultats?: AdrecaSearchResult[] };
    return json.resultats || [];
  } catch {
    return [];
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

// One row per street+number, so counting rows gives the number of addresses in an area.
export async function fetchApartmentMap(): Promise<AddressGroup[]> {
  try {
    const res = await fetch(`${GUIRI_API_BASE}/api/v1/apartments/map`);
    const json = (await res.json()) as ApartmentSearchResponse;
    return json?.data || [];
  } catch {
    return [];
  }
}

export async function fetchDistrictStats(): Promise<DistrictStat[]> {
  try {
    const res = await fetch(`${GUIRI_API_BASE}/api/v1/apartments/districts`);
    const json = (await res.json()) as DistrictListResponse;
    return json?.data || [];
  } catch {
    return [];
  }
}

export async function fetchNeighborhoodStats(): Promise<NeighborhoodStat[]> {
  try {
    const res = await fetch(`${GUIRI_API_BASE}/api/v1/apartments/neighborhoods`);
    const json = (await res.json()) as NeighborhoodListResponse;
    return json?.data || [];
  } catch {
    return [];
  }
}
