"""
point_in_seccio_censal.py
--------------------------
Given a (lat, lon) coordinate, find which Barcelona census section (seccio
censal) contains it and return all associated metadata.

Data source:
    BarcelonaCiutat_SeccionsCensals.csv  (same directory)
    Column `geometria_wgs84` holds WKT POLYGON geometries in WGS84 (EPSG:4326).

Usage (CLI):
    python point_in_seccio_censal.py <lat> <lon>
    python point_in_seccio_censal.py 41.3851 2.1734

Usage (import):
    from point_in_seccio_censal import SeccionsCensalsLookup

    lookup = SeccionsCensalsLookup()                # loads & indexes data once
    result = lookup.find(lat=41.3851, lon=2.1734)
    if result:
        print(result)
    else:
        print("Point is outside Barcelona census section boundaries")
"""

import csv
import json
import sys
from pathlib import Path
from dataclasses import dataclass, asdict, field
from typing import Optional, List

from shapely import wkt as shapely_wkt
from shapely.geometry import Point, mapping
from shapely.strtree import STRtree


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class SeccióCensal:
    codi_districte: str
    nom_districte: str
    codi_barri: str
    nom_barri: str
    codi_aeb: str
    codi_seccio_censal: str
    geometry_wkt: str = field(default="", repr=False)      # WKT string
    geometry_geojson: dict = field(default_factory=dict, repr=False)  # GeoJSON dict


# ---------------------------------------------------------------------------
# Core lookup class
# ---------------------------------------------------------------------------

class SeccionsCensalsLookup:
    """
    Loads BarcelonaCiutat_SeccionsCensals.csv once, builds an STRtree spatial
    index, and answers point-in-polygon queries efficiently.

    An STRtree (Sort-Tile-Recursive R-tree) enables O(log n) candidate
    filtering before the exact `contains` check, making it suitable for
    millions of lookups against the ~1 000 census sections.
    """

    CSV_FILE = Path(__file__).parent / "BarcelonaCiutat_SeccionsCensals.csv"
    WGS84_COL = "geometria_wgs84"

    def __init__(self, csv_path: Optional[Path] = None) -> None:
        path = csv_path or self.CSV_FILE
        self._records: list[SeccióCensal] = []
        self._geometries: list = []          # shapely Polygon objects
        self._tree: Optional[STRtree] = None

        self._load(path)
        self._build_index()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load(self, path: Path) -> None:
        """Parse the CSV and store metadata + geometries in parallel lists."""
        with open(path, newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                raw_geom = row[self.WGS84_COL].strip()
                try:
                    geom = shapely_wkt.loads(raw_geom)
                except Exception as exc:
                    # Skip rows with unparseable geometry but warn loudly
                    print(
                        f"[WARN] Could not parse geometry for seccio "
                        f"{row.get('codi_seccio_censal', '?')}: {exc}",
                        file=sys.stderr,
                    )
                    continue

                self._records.append(
                    SeccióCensal(
                        codi_districte=row["codi_districte"],
                        nom_districte=row["nom_districte"],
                        codi_barri=row["codi_barri"],
                        nom_barri=row["nom_barri"],
                        codi_aeb=row["codi_aeb"],
                        codi_seccio_censal=row["codi_seccio_censal"],
                        geometry_wkt=raw_geom,
                        geometry_geojson=dict(mapping(geom)),
                    )
                )
                self._geometries.append(geom)

    def _build_index(self) -> None:
        """Build an STRtree spatial index over all polygon geometries."""
        self._tree = STRtree(self._geometries)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def _find_with_index(self, lat: float, lon: float):
        """
        Internal: return (SeccióCensal, list_index) for the polygon that
        contains the point, or (None, -1) if no match.
        """
        point = Point(lon, lat)  # shapely: (x=lon, y=lat)

        # STRtree.query() returns indices of candidates whose bounding boxes
        # overlap the point — fast pre-filter.
        candidate_indices = self._tree.query(point)

        for idx in candidate_indices:
            if self._geometries[int(idx)].contains(point):
                return self._records[int(idx)], int(idx)

        return None, -1

    def find(self, lat: float, lon: float) -> Optional[SeccióCensal]:
        """Return the SeccióCensal entry whose polygon contains the point."""
        result, _ = self._find_with_index(lat, lon)
        return result

    def find_neighbors(self, lat: float, lon: float) -> List["SeccióCensal"]:
        """
        Return all census sections that share a border (or touch) with the
        one containing the query point. The matched section itself is excluded.
        """
        result, matched_idx = self._find_with_index(lat, lon)
        if result is None:
            return []

        main_geom = self._geometries[matched_idx]
        # Expand bounding box slightly to catch polygons that only touch
        candidate_indices = self._tree.query(main_geom)

        neighbors = []
        for idx in candidate_indices:
            if int(idx) == matched_idx:
                continue
            if main_geom.touches(self._geometries[int(idx)]) or main_geom.intersects(self._geometries[int(idx)]):
                neighbors.append(self._records[int(idx)])

        return neighbors

    def find_dict(self, lat: float, lon: float) -> Optional[dict]:
        """Same as find() but returns a plain dict instead of a dataclass."""
        result = self.find(lat, lon)
        return asdict(result) if result else None

    def find_svg(self, lat: float, lon: float, **kwargs) -> Optional[str]:
        """
        Return an SVG string visualising the matched polygon, its adjacent
        neighbors, and the query point.

        Extra keyword arguments are forwarded to render_svg() (width, height,
        padding).
        """
        result, matched_idx = self._find_with_index(lat, lon)
        if result is None:
            return None
        neighbors = self.find_neighbors(lat, lon)
        return render_svg(result, lat, lon, neighbors=neighbors, **kwargs)

    def find_geojson_feature(self, lat: float, lon: float) -> Optional[dict]:
        """
        Return the matched census section as a GeoJSON Feature, ready to be
        embedded in a FeatureCollection or sent from an API.
        """
        result = self.find(lat, lon)
        if result is None:
            return None
        return {
            "type": "Feature",
            "geometry": result.geometry_geojson,
            "properties": {
                "codi_districte": result.codi_districte,
                "nom_districte": result.nom_districte,
                "codi_barri": result.codi_barri,
                "nom_barri": result.nom_barri,
                "codi_aeb": result.codi_aeb,
                "codi_seccio_censal": result.codi_seccio_censal,
            },
        }


# ---------------------------------------------------------------------------
# SVG rendering
# ---------------------------------------------------------------------------

def _geojson_to_svg_path(coords: list, project) -> str:
    """Convert a list of [lon, lat] ring coordinates to an SVG path `d` string."""
    parts = []
    for i, (lo, la) in enumerate(coords):
        x, y = project(lo, la)
        parts.append(f"{'M' if i == 0 else 'L'}{x},{y}")
    parts.append("Z")
    return " ".join(parts)


def render_svg(
    result: "SeccióCensal",
    lat: float,
    lon: float,
    neighbors: Optional[List["SeccióCensal"]] = None,
    width: int = 600,
    height: int = 600,
    padding: int = 40,
) -> str:
    """
    Render the matched polygon, adjacent neighbors, and the query point as SVG.

    Projection: equirectangular (plate carrée)
        x = (lon - lon_min) / (lon_max - lon_min) * viewport_width
        y = (lat_max - lat) / (lat_max - lat_min) * viewport_height  [y flipped]

    Args:
        result    : SeccióCensal returned by find()
        lat       : query latitude
        lon       : query longitude
        neighbors : adjacent SeccióCensal list (from find_neighbors())
        width     : SVG canvas width  in pixels  (default 600)
        height    : SVG canvas height in pixels  (default 600)
        padding   : blank border in pixels       (default 40)
    """
    neighbors = neighbors or []

    # ------------------------------------------------------------------ #
    # Compute bounding box across main polygon + all neighbors            #
    # ------------------------------------------------------------------ #
    all_sections = [result] + neighbors
    all_lons, all_lats = [], []
    for sec in all_sections:
        ring = sec.geometry_geojson["coordinates"][0]
        all_lons.extend(c[0] for c in ring)
        all_lats.extend(c[1] for c in ring)

    lon_min, lon_max = min(all_lons), max(all_lons)
    lat_min, lat_max = min(all_lats), max(all_lats)

    lon_pad = (lon_max - lon_min) * 0.08 or 0.001
    lat_pad = (lat_max - lat_min) * 0.08 or 0.001
    lon_min -= lon_pad;  lon_max += lon_pad
    lat_min -= lat_pad;  lat_max += lat_pad

    vw = width  - 2 * padding
    vh = height - 2 * padding

    def project(lo: float, la: float) -> tuple[float, float]:
        x = padding + (lo - lon_min) / (lon_max - lon_min) * vw
        y = padding + (lat_max - la) / (lat_max - lat_min) * vh
        return round(x, 2), round(y, 2)

    # ------------------------------------------------------------------ #
    # Build neighbor paths                                                 #
    # ------------------------------------------------------------------ #
    neighbor_paths = []
    for nb in neighbors:
        ring = nb.geometry_geojson["coordinates"][0]
        d = _geojson_to_svg_path(ring, project)
        neighbor_paths.append(
            f'  <path d="{d}"\n'
            f'        fill="#b0c4d8" fill-opacity="0.35"\n'
            f'        stroke="#8aaec8" stroke-width="1" stroke-linejoin="round"/>'
        )

    # ------------------------------------------------------------------ #
    # Build main polygon path                                              #
    # ------------------------------------------------------------------ #
    main_ring = result.geometry_geojson["coordinates"][0]
    main_d = _geojson_to_svg_path(main_ring, project)

    # ------------------------------------------------------------------ #
    # Query point                                                          #
    # ------------------------------------------------------------------ #
    px, py = project(lon, lat)

    # ------------------------------------------------------------------ #
    # Labels                                                               #
    # ------------------------------------------------------------------ #
    bb_tl = f"{lat_max:.5f}, {lon_min:.5f}"
    bb_br = f"{lat_min:.5f}, {lon_max:.5f}"
    title = (
        f"{result.nom_districte} · {result.nom_barri} "
        f"(seccio {result.codi_seccio_censal})"
    )
    point_label = f"({lat}, {lon})"
    neighbor_count = len(neighbors)

    # ------------------------------------------------------------------ #
    # Assemble SVG                                                         #
    # ------------------------------------------------------------------ #
    neighbor_block = "\n".join(neighbor_paths)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg"
     width="{width}" height="{height}"
     viewBox="0 0 {width} {height}">

  <!-- Background -->
  <rect width="{width}" height="{height}" fill="#f0f4f8" rx="6"/>

  <!-- Adjacent census sections ({neighbor_count} neighbors) -->
{neighbor_block}

  <!-- Matched census section -->
  <path d="{main_d}"
        fill="#4e79a7" fill-opacity="0.45"
        stroke="#2c5f8a" stroke-width="2.5"
        stroke-linejoin="round"/>

  <!-- Query point -->
  <circle cx="{px}" cy="{py}" r="6"
          fill="#e05c2a" stroke="white" stroke-width="2"/>
  <circle cx="{px}" cy="{py}" r="13"
          fill="none" stroke="#e05c2a" stroke-width="1.5" opacity="0.5"/>

  <!-- Point label -->
  <text x="{px + 16}" y="{py - 7}"
        font-family="monospace" font-size="11" fill="#c0421a">{point_label}</text>

  <!-- Title -->
  <text x="{width // 2}" y="20"
        text-anchor="middle" font-family="sans-serif" font-size="13"
        font-weight="bold" fill="#222">{title}</text>

  <!-- Legend -->
  <rect x="{padding}" y="{height - padding + 6}" width="12" height="10"
        fill="#4e79a7" fill-opacity="0.45" stroke="#2c5f8a" stroke-width="1"/>
  <text x="{padding + 16}" y="{height - padding + 15}"
        font-family="sans-serif" font-size="10" fill="#555">matched seccio</text>
  <rect x="{padding + 105}" y="{height - padding + 6}" width="12" height="10"
        fill="#b0c4d8" fill-opacity="0.6" stroke="#8aaec8" stroke-width="1"/>
  <text x="{padding + 121}" y="{height - padding + 15}"
        font-family="sans-serif" font-size="10" fill="#555">adjacent ({neighbor_count})</text>
  <circle cx="{padding + 220}" cy="{height - padding + 11}" r="5"
          fill="#e05c2a" stroke="white" stroke-width="1.5"/>
  <text x="{padding + 230}" y="{height - padding + 15}"
        font-family="sans-serif" font-size="10" fill="#555">query point</text>

  <!-- Bounding-box corner labels -->
  <text x="{padding + 2}" y="{padding - 5}"
        font-family="monospace" font-size="9" fill="#aaa">{bb_tl}</text>
  <text x="{width - padding - 2}" y="{height - padding + 28}"
        text-anchor="end" font-family="monospace" font-size="9" fill="#aaa">{bb_br}</text>
</svg>"""
    return svg


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python point_in_seccio_censal.py <lat> <lon>")
        print("Example: python point_in_seccio_censal.py 41.3851 2.1734")
        sys.exit(1)

    try:
        lat = float(sys.argv[1])
        lon = float(sys.argv[2])
    except ValueError:
        print("Error: lat and lon must be numeric values.", file=sys.stderr)
        sys.exit(1)

    lookup = SeccionsCensalsLookup()
    result = lookup.find(lat, lon)

    if result:
        print(f"\nPoint ({lat}, {lon}) is INSIDE:")
        print(f"  Districte     : {result.codi_districte} - {result.nom_districte}")
        print(f"  Barri         : {result.codi_barri} - {result.nom_barri}")
        print(f"  AEB           : {result.codi_aeb}")
        print(f"  Seccio censal : {result.codi_seccio_censal}")

        neighbors = lookup.find_neighbors(lat, lon)
        print(f"  Adjacent      : {len(neighbors)} neighboring seccions")

        svg = render_svg(result, lat, lon, neighbors=neighbors)
        out_path = Path(__file__).parent / f"seccio_{result.codi_districte}_{result.codi_seccio_censal}.svg"
        out_path.write_text(svg, encoding="utf-8")
        print(f"\nSVG saved → {out_path}")
    else:
        print(f"\nPoint ({lat}, {lon}) is OUTSIDE all Barcelona census section boundaries.")


if __name__ == "__main__":
    _main()
