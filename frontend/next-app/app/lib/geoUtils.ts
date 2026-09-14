import type { FeatureCollection, Geometry, Position } from 'geojson';
import { feature as topoFeature } from 'topojson-client';
import type { Topology, GeometryCollection as TopoGeometryCollection } from 'topojson-specification';
import proj4 from 'proj4';

export interface PropertyGroupSummary {
  value: string;
  count: number;
}

// Barcelona's official open data ships in UTM zone 31N metres, not lon/lat.
export const EPSG_25831 = '+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
export const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';

/** Accepts either a GeoJSON FeatureCollection or a TopoJSON Topology (first object is used). */
export function toFeatureCollection(raw: unknown): FeatureCollection<Geometry> {
  const candidate = raw as { type?: string };
  if (candidate?.type !== 'Topology') return raw as FeatureCollection<Geometry>;

  const topology = raw as Topology;
  const objectName = Object.keys(topology.objects)[0];
  return topoFeature(topology, topology.objects[objectName] as TopoGeometryCollection) as FeatureCollection<Geometry>;
}

/** Counts features by a property value — useful to discover the distinct levels (e.g. TIPUS_UA) mixed into one GeoJSON file. */
export function summarizeFeaturesByProperty(
  geoData: FeatureCollection<Geometry>,
  property: string
): PropertyGroupSummary[] {
  const counts = new Map<string, number>();
  geoData.features.forEach((feature) => {
    const value = String(feature.properties?.[property] ?? '(none)').trim();
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

export function filterFeaturesByProperty(
  geoData: FeatureCollection<Geometry>,
  property: string,
  value: string
): FeatureCollection<Geometry> {
  return {
    ...geoData,
    features: geoData.features.filter((feature) => String(feature.properties?.[property] ?? '').trim() === value),
  };
}

const mapPositions = (coordinates: unknown, transform: (position: Position) => Position): unknown => {
  if (!Array.isArray(coordinates)) return coordinates;
  if (typeof coordinates[0] === 'number') return transform(coordinates as Position);
  return coordinates.map((child) => mapPositions(child, transform));
};

/** Converts every coordinate of a FeatureCollection from `sourceCrs` to WGS84 lon/lat so layers can share one projection. */
function reprojectToWgs84(
  geoData: FeatureCollection<Geometry>,
  sourceCrs: string
): FeatureCollection<Geometry> {
  const converter = proj4(sourceCrs, WGS84);
  const transform = (position: Position): Position => {
    const [lon, lat] = converter.forward([position[0], position[1]]);
    return [lon, lat];
  };

  return {
    ...geoData,
    features: geoData.features.map((feature) => {
      const geometry = feature.geometry;
      if (!geometry || geometry.type === 'GeometryCollection') return feature;
      return {
        ...feature,
        geometry: {
          ...geometry,
          coordinates: mapPositions(geometry.coordinates, transform),
        } as Geometry,
      };
    }),
  };
}

const signedArea = (ring: Position[]) => {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
};

// d3-geo reads polygons spherically and expects clockwise exterior rings (holes counter-clockwise);
// shapefile exports often use the opposite winding, which makes a polygon cover the whole globe.
const rewindRings = (rings: Position[][]) =>
  rings.map((ring, idx) => {
    const isClockwise = signedArea(ring) < 0;
    return isClockwise === (idx === 0) ? ring : [...ring].reverse();
  });

function rewindForD3(geoData: FeatureCollection<Geometry>): FeatureCollection<Geometry> {
  return {
    ...geoData,
    features: geoData.features.map((feature) => {
      const geometry = feature.geometry;
      if (geometry?.type === 'Polygon') {
        return { ...feature, geometry: { ...geometry, coordinates: rewindRings(geometry.coordinates) } };
      }
      if (geometry?.type === 'MultiPolygon') {
        return { ...feature, geometry: { ...geometry, coordinates: geometry.coordinates.map(rewindRings) } };
      }
      return feature;
    }),
  };
}

/** Makes a layer renderable by a spherical d3 projection: lon/lat coordinates with d3's ring winding. */
export function prepareLayer(
  geoData: FeatureCollection<Geometry>,
  sourceCrs?: string
): FeatureCollection<Geometry> {
  return rewindForD3(sourceCrs ? reprojectToWgs84(geoData, sourceCrs) : geoData);
}
