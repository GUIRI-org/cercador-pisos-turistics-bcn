import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

const TERRITORI_URL = 'https://geoportal.barcelona.cat/geoBCN/serveis/territori';

interface BcnArea {
  codi: string;
  descripcio?: string;
  nom?: string;
  districteId?: string;
  geometria?: { proj?: string; type: string; coordinates: unknown };
  localitzacio?: { x: number; y: number };
}

interface BcnResponse {
  estat?: string;
  resultats?: BcnArea[];
}

async function fetchBcn(path: string): Promise<BcnArea[]> {
  const res = await fetch(`${TERRITORI_URL}/${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as BcnResponse;
  if (json.estat !== 'OK' || !Array.isArray(json.resultats)) throw new Error('Unexpected GeoBCN response');
  return json.resultats;
}

const toGeometry = (area: BcnArea & { geometria: NonNullable<BcnArea['geometria']> }) =>
  ({ type: area.geometria.type, coordinates: area.geometria.coordinates }) as Geometry;

const insideRing = (x: number, y: number, ring: Position[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// Even-odd across rings, so holes are excluded.
const insidePolygon = (x: number, y: number, rings: Position[][]) =>
  rings.reduce((inside, ring) => (insideRing(x, y, ring) ? !inside : inside), false);

/** Planar point-in-polygon; `x`/`y` must be in the geometry's own CRS (EPSG:25831 for GeoBCN shapes). */
export function pointInGeometry(x: number, y: number, geometry: Geometry): boolean {
  if (geometry.type === 'Polygon') return insidePolygon(x, y, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((polygon) => insidePolygon(x, y, polygon));
  return false;
}

let adminAreas: Promise<FeatureCollection<Geometry>> | null = null;

/**
 * Districts and barris from GeoBCN (EPSG:25831), as features with the same properties as the local
 * file: TIPUS_UA, DISTRICTE, BARRI, NOM. The barris endpoint has no district link, so each barri
 * takes the district that contains its location point.
 */
export function fetchBcnAdminAreas(): Promise<FeatureCollection<Geometry>> {
  adminAreas ??= Promise.all([fetchBcn('districtes?geometria=true'), fetchBcn('barris?geometria=true')])
    .then(([districts, barris]) => {
      const districtFeatures = districts.flatMap((district): Feature<Geometry>[] =>
        district.geometria
          ? [{
              type: 'Feature',
              properties: { TIPUS_UA: 'DISTRICTE', DISTRICTE: district.codi, CODI_UA: district.codi, NOM: district.descripcio },
              geometry: toGeometry({ ...district, geometria: district.geometria }),
            }]
          : []
      );

      const barriFeatures = barris.flatMap((barri): Feature<Geometry>[] => {
        if (!barri.geometria) return [];
        const location = barri.localitzacio;
        const district = location
          ? districtFeatures.find((feature) => pointInGeometry(location.x, location.y, feature.geometry))
          : undefined;
        return [{
          type: 'Feature',
          properties: {
            TIPUS_UA: 'BARRI',
            BARRI: barri.codi,
            CODI_UA: barri.codi,
            DISTRICTE: district?.properties?.DISTRICTE ?? '',
            NOM: barri.nom,
          },
          geometry: toGeometry({ ...barri, geometria: barri.geometria }),
        }];
      });

      return { type: 'FeatureCollection' as const, features: [...districtFeatures, ...barriFeatures] };
    })
    .catch((error) => {
      adminAreas = null;
      throw error;
    });

  return adminAreas;
}

const illaByPoint = new Map<string, Promise<Feature<Geometry> | null>>();

/** The illa (city block) containing an EPSG:25831 point, or null when the point is outside every block. */
export function fetchIllaAt(x: number, y: number): Promise<Feature<Geometry> | null> {
  const [px, py] = [x.toFixed(3), y.toFixed(3)];
  const key = `${px},${py}`;
  let cached = illaByPoint.get(key);

  if (!cached) {
    cached = fetchBcn(`illes?x=${px}&y=${py}&geometria=true`).then(([illa]) =>
      illa?.geometria
        ? {
            type: 'Feature' as const,
            properties: { TIPUS_UA: 'ILLA', ILLA: illa.codi, NOM: `Illa ${illa.codi}`, DISTRICTE: illa.districteId ?? '' },
            geometry: toGeometry({ ...illa, geometria: illa.geometria }),
          }
        : null
    );
    // Failed lookups are dropped so a later visit retries them.
    cached.catch(() => illaByPoint.delete(key));
    illaByPoint.set(key, cached);
  }

  return cached;
}
