# Seccions Censals — Point-in-Polygon Lookup

Utility to determine which Barcelona administrative unit (census section, neighbourhood, district) a given lat/lon coordinate belongs to.

## Files

| File | Description |
|------|-------------|
| `BarcelonaCiutat_SeccionsCensals.csv` | Official boundary data — ~1 067 census sections with WKT polygons in WGS84 and ETRS89 |
| `point_in_seccio_censal.py` | Python module + CLI for point-in-polygon lookup and SVG rendering |
| `POINT_IN_POLYGON_GUIDE.md` | Full methodology guide (PostGIS, GeoPandas, math behind the algorithm) |
| `QUICK_START_POINT_IN_POLYGON.md` | Step-by-step implementation cheatsheet |

## Data source

[Barcelona Open Data — Seccions Censals](https://opendata-ajuntament.barcelona.cat/)  
Columns: `codi_districte`, `nom_districte`, `codi_barri`, `nom_barri`, `codi_aeb`, `codi_seccio_censal`, `geometria_etrs89`, `geometria_wgs84`

## Requirements

```bash
pip install shapely
```

## Usage

### CLI

```bash
python point_in_seccio_censal.py <lat> <lon>
python point_in_seccio_censal.py 41.3851 2.1734
```

Output:
```
Point (41.3851, 2.1734) is INSIDE:
  Districte     : 01 - Ciutat Vella
  Barri         : 02 - el Barri Gòtic
  AEB           : 009
  Seccio censal : 022
  Adjacent      : 6 neighboring seccions

SVG saved → seccio_01_022.svg
```

### Python API

```python
from point_in_seccio_censal import SeccionsCensalsLookup

lookup = SeccionsCensalsLookup()   # load once, reuse for millions of lookups

# Returns a SeccióCensal dataclass or None
result = lookup.find(lat=41.3851, lon=2.1734)
print(result.nom_districte, result.nom_barri, result.codi_seccio_censal)

# Plain dict
d = lookup.find_dict(lat=41.3851, lon=2.1734)

# GeoJSON Feature (geometry + properties)
feature = lookup.find_geojson_feature(lat=41.3851, lon=2.1734)

# Adjacent census sections (share a border)
neighbors = lookup.find_neighbors(lat=41.3851, lon=2.1734)

# SVG string — matched polygon + neighbors + point
svg = lookup.find_svg(lat=41.3851, lon=2.1734)
svg = lookup.find_svg(lat=41.3851, lon=2.1734, width=800, height=800)
```

### Return type — `SeccióCensal`

| Field | Type | Example |
|-------|------|---------|
| `codi_districte` | `str` | `"01"` |
| `nom_districte` | `str` | `"Ciutat Vella"` |
| `codi_barri` | `str` | `"02"` |
| `nom_barri` | `str` | `"el Barri Gòtic"` |
| `codi_aeb` | `str` | `"009"` |
| `codi_seccio_censal` | `str` | `"022"` |
| `geometry_wkt` | `str` | WKT POLYGON string |
| `geometry_geojson` | `dict` | GeoJSON geometry dict |

## How it works

1. **Load** — CSV is parsed once; WKT polygons are converted to Shapely geometries.
2. **Index** — An STRtree (Sort-Tile-Recursive R-tree) is built over all ~1 067 polygons.
3. **Query** — For each point:
   - STRtree filters candidates by bounding box — O(log n)
   - Ray-casting `contains()` check on candidates — O(k), k ≪ n
4. **Neighbors** — Adjacent sections found by querying STRtree with the matched polygon and filtering with `touches()` / `intersects()`.
5. **SVG** — Equirectangular projection maps all polygons to pixel space; matched section, neighbors, and point rendered in layers.

## Performance

| Operation | Time |
|-----------|------|
| Initial load + index | ~0.3 s |
| Single point lookup | < 1 ms |
| 1 M lookups (reusing instance) | ~30–60 s |


## Next

- look for the entire Catalunya seccions censals
- For Barcelone we used this https://opendata-ajuntament.barcelona.cat/data/ca/dataset/808daafa-d9ce-48c0-925a-fa5afdb1ed41/resource/11851135-6919-4dcb-91ed-821e5e87a428
- For the entire Catalunya let's check:
    - https://ide.cat/geonetwork/srv/cat/catalog.search#/metadata/seccions-censals-v1r0-20250101
    - https://www.icgc.cat/ca/Geoinformacio-i-mapes/Dades-i-productes/Geoinformacio-cartografica/Seccions-censals
