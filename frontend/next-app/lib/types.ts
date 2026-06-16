// Barcelona territory API types
export interface TipusVia {
  codi: string;
  abreviatura: string;
  nom: string;
}

export interface CarrerVia {
  codi: string;
  nom: string;
  nomComplet?: string;
  tipusVia: {
    codi: string;
    nom: string;
  };
}

export interface AdrecaSearchResult {
  carrer: {
    codi: string;
  };
  numeracioPostal: string;
}

export interface TerritoriResponse {
  resultats: {
    tipusvies?: TipusVia[];
    vies?: CarrerVia[];
    adreces?: AdrecaSearchResult[];
  };
}

// Internal GUIRI API types
export interface ApartmentDetail {
  expedient: string;
  registre_generalitat?: string;
  num_places?: number;
  year?: number;
  bloc?: string;
  portal?: string;
  escala?: string;
  pis?: string;
  porta?: string;
}

export interface AddressGroup {
  address: string;
  tipus_carrer?: string;
  carrer?: string;
  num1?: number;
  lletra1?: string;
  num2?: number;
  lletra2?: string;
  codi_districte?: number;
  nom_districte?: string;
  codi_barri?: number;
  nom_barri?: string;
  longitud_x?: number;
  latitud_y?: number;
  apartments_count: number;
  total_places: number;
  apartments: ApartmentDetail[];
}

export interface ApartmentSearchResponse {
  data: AddressGroup[];
  meta: {
    total: number;
  };
}
