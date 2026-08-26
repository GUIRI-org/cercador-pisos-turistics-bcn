import {
  TerritoriResponse,
  TipusVia,
  CarrerVia,
  AdrecaSearchResult,
  ApartmentSearchResponse,
  AddressGroup,
  ApartmentDetail,
} from './types';

const BASE = 'https://geoportal.barcelona.cat/geoBCN/serveis/territori';
const GUIRI_API_BASE = process.env.NEXT_PUBLIC_GUIRI_API_BASE || 'http://127.0.0.1:9092';
const OPENDATA_DATASTORE_BASE = 'https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search';
const OPENDATA_HUT_RESOURCE_ID = 'b32fa7f6-d464-403b-8a02-0292a64883bf';

type OpenDataApartmentRecord = Record<string, string | number | null | undefined>;

interface OpenDataDatastoreResponse {
  success?: boolean;
  result?: {
    records?: OpenDataApartmentRecord[];
    total?: number;
  };
}

const readOpenDataField = (record: OpenDataApartmentRecord, field: string) => {
  return record[field] ?? record[field.toLowerCase()] ?? null;
};

const parseNullableNumber = (value: string | number | null | undefined): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeAddressPart = (value: string | number | null | undefined) => String(value ?? '').trim().toLowerCase();

const buildAddressGroupKey = (group: AddressGroup) => {
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

const buildOpenDataAddressLabel = (
  tipusCarrer?: string,
  carrer?: string,
  num1?: number,
  lletra1?: string,
  num2?: number,
  lletra2?: string
) => {
  const street = [tipusCarrer, carrer].filter(Boolean).join(' ').trim();
  const firstNumber = num1 !== undefined ? `${num1}${lletra1 || ''}` : '';
  const secondNumber = num2 !== undefined ? `${num2}${lletra2 || ''}` : '';
  const numbers = [firstNumber, secondNumber].filter(Boolean).join(' - ');
  return [street, numbers].filter(Boolean).join(', ').trim();
};

const mapOpenDataRecordToGroup = (record: OpenDataApartmentRecord): AddressGroup => {
  const tipusCarrer = String(readOpenDataField(record, 'TIPUS_CARRER') ?? '').trim() || undefined;
  const carrer = String(readOpenDataField(record, 'CARRER') ?? '').trim() || undefined;
  const lletra1 = String(readOpenDataField(record, 'LLETRA1') ?? '').trim() || undefined;
  const lletra2 = String(readOpenDataField(record, 'LLETRA2') ?? '').trim() || undefined;
  const num1 = parseNullableNumber(readOpenDataField(record, 'NUM1'));
  const num2 = parseNullableNumber(readOpenDataField(record, 'NUM2'));
  const apartment: ApartmentDetail = {
    expedient: String(readOpenDataField(record, 'N_EXPEDIENT') ?? '').trim(),
    registre_generalitat: String(readOpenDataField(record, 'NUMERO_REGISTRE_GENERALITAT') ?? '').trim() || undefined,
    num_places: parseNullableNumber(readOpenDataField(record, 'NUMERO_PLACES')),
    bloc: String(readOpenDataField(record, 'BLOC') ?? '').trim() || undefined,
    portal: String(readOpenDataField(record, 'PORTAL') ?? '').trim() || undefined,
    escala: String(readOpenDataField(record, 'ESCALA') ?? '').trim() || undefined,
    pis: String(readOpenDataField(record, 'PIS') ?? '').trim() || undefined,
    porta: String(readOpenDataField(record, 'PORTA') ?? '').trim() || undefined,
  };

  return {
    address: buildOpenDataAddressLabel(tipusCarrer, carrer, num1, lletra1, num2, lletra2) || 'Adreça no disponible',
    tipus_carrer: tipusCarrer,
    carrer,
    num1,
    lletra1,
    num2,
    lletra2,
    codi_districte: parseNullableNumber(readOpenDataField(record, 'CODI_DISTRICTE')),
    nom_districte: String(readOpenDataField(record, 'NOM_DISTRICTE') ?? '').trim() || undefined,
    codi_barri: parseNullableNumber(readOpenDataField(record, 'CODI_BARRI')),
    nom_barri: String(readOpenDataField(record, 'NOM_BARRI') ?? '').trim() || undefined,
    longitud_x: parseNullableNumber(readOpenDataField(record, 'LONGITUD_X')),
    latitud_y: parseNullableNumber(readOpenDataField(record, 'LATITUD_Y')),
    apartments_count: 1,
    total_places: apartment.num_places || 0,
    apartments: [apartment],
  };
};

const mergeAddressGroups = (groups: AddressGroup[]): AddressGroup[] => {
  const merged = new Map<string, AddressGroup>();

  groups.forEach((group) => {
    const key = buildAddressGroupKey(group);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...group,
        apartments: [...group.apartments],
      });
      return;
    }

    const apartmentKey = (apt: ApartmentDetail) => [
      apt.expedient || '',
      apt.registre_generalitat || '',
      apt.bloc || '',
      apt.portal || '',
      apt.escala || '',
      apt.pis || '',
      apt.porta || '',
      String(apt.num_places ?? ''),
    ].join('|').toLowerCase();

    const apartmentsByKey = new Map<string, ApartmentDetail>();
    [...existing.apartments, ...group.apartments].forEach((apt) => {
      apartmentsByKey.set(apartmentKey(apt), apt);
    });

    const apartments = Array.from(apartmentsByKey.values());
    merged.set(key, {
      ...existing,
      apartments,
      apartments_count: apartments.length,
      total_places: apartments.reduce((sum, apt) => sum + (apt.num_places || 0), 0),
    });
  });

  return Array.from(merged.values());
};

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

export async function searchApartmentsOpenData(query: string): Promise<AddressGroup[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const limit = 1000;
    let offset = 0;
    let total = 0;
    const records: OpenDataApartmentRecord[] = [];

    do {
      const qs = new URLSearchParams({
        resource_id: OPENDATA_HUT_RESOURCE_ID,
        q,
        limit: String(limit),
        offset: String(offset),
      });
      const res = await fetch(`${OPENDATA_DATASTORE_BASE}?${qs}`);
      const json = (await res.json()) as OpenDataDatastoreResponse;

      const chunk = json.result?.records || [];
      total = json.result?.total || 0;
      records.push(...chunk);
      offset += chunk.length;

      if (!chunk.length) break;
    } while (offset < total);

    return mergeAddressGroups(records.map(mapOpenDataRecordToGroup));
  } catch {
    return [];
  }
}
