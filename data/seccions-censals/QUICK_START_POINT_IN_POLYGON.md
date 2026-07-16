# Quick Start: Point-in-Polygon Implementation for 8M Points

**TL;DR**: Use PostGIS with proper indexing. Expected time: 15-30 minutes for 8M points.

---

## 1️⃣ Download Boundary Data

```bash
# Create data directory
mkdir -p data/seccions_censals

# Download from Barcelona Open Data
# https://opendata-ajuntament.barcelona.cat/
# Search "seccions_censals" → Download ZIP

# Or use this (if direct link available)
cd data/seccions_censals
unzip seccions_censals.zip
```

---

## 2️⃣ Create Tables in PostgreSQL

```sql
-- Connect to your database
psql -h localhost -U postgres -d cercador_pisos

-- Copy-paste this entire SQL block:

CREATE TABLE barcelona.districts_boundaries (
    id SERIAL PRIMARY KEY,
    codi_districte SMALLINT UNIQUE NOT NULL,
    nom_districte VARCHAR(100) NOT NULL,
    geom GEOMETRY(Polygon, 4326) NOT NULL
);

CREATE TABLE barcelona.seccions_censals (
    id SERIAL PRIMARY KEY,
    secció_censal VARCHAR(10) UNIQUE NOT NULL,
    codi_districte SMALLINT NOT NULL,
    nom_barri VARCHAR(100),
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    FOREIGN KEY (codi_districte) REFERENCES barcelona.districts_boundaries(codi_districte)
);

-- Create indexes (ESSENTIAL!)
CREATE INDEX idx_districts_geom ON barcelona.districts_boundaries USING GIST(geom);
CREATE INDEX idx_seccions_geom ON barcelona.seccions_censals USING GIST(geom);
CREATE INDEX idx_seccions_districte ON barcelona.seccions_censals(codi_districte);
```

---

## 3️⃣ Load Shapefile Data

### Option A: Using Command Line (Fastest)

```bash
# Install shp2pgsql if needed
# macOS: brew install postgis
# Linux: sudo apt-get install postgis

# Convert shapefile to SQL and load
shp2pgsql -I -S -c -s 4326 data/seccions_censals/seccions_censals.shp barcelona.seccions_censals | \
  psql -h localhost -U postgres -d cercador_pisos
```

### Option B: Using Python (if you have Shapefile)

```python
import geopandas as gpd
from sqlalchemy import create_engine

# Read shapefile
gdf = gpd.read_file('data/seccions_censals/seccions_censals.shp')

# Connect to database
engine = create_engine('postgresql://postgres:password@localhost/cercador_pisos')

# Write to database
gdf.to_postgis('seccions_censals', engine, schema='barcelona', if_exists='replace', index=False)

print("✅ Data loaded successfully!")
```

---

## 4️⃣ Match Your 8M Points to Seccions

```sql
-- Add columns to store results (if not already there)
ALTER TABLE barcelona.habitatges_us_turistic 
ADD COLUMN IF NOT EXISTS secció_censal VARCHAR(10);

-- ONE-TIME BULK OPERATION (takes 15-30 min for 8M points)
UPDATE barcelona.habitatges_us_turistic h
SET secció_censal = s.secció_censal
FROM barcelona.seccions_censals s
WHERE ST_Contains(s.geom, h.geom)
  AND h.secció_censal IS NULL;

-- Check how many matched
SELECT COUNT(*) as total, COUNT(secció_censal) as matched
FROM barcelona.habitatges_us_turistic;
```

---

## 5️⃣ Verify Results

```sql
-- Show sample results
SELECT 
    n_expedient,
    nom_districte,
    nom_barri,
    secció_censal,
    latitud_y,
    longitud_x
FROM barcelona.habitatges_us_turistic
WHERE secció_censal IS NOT NULL
LIMIT 10;

-- Count by district
SELECT 
    nom_districte,
    COUNT(*) as total_points,
    COUNT(DISTINCT secció_censal) as unique_seccions
FROM barcelona.habitatges_us_turistic
WHERE secció_censal IS NOT NULL
GROUP BY nom_districte
ORDER BY total_points DESC;
```

---

## 6️⃣ For New Points (Real-time Lookup)

```sql
-- Create function for quick lookups
CREATE OR REPLACE FUNCTION barcelona.get_secció_censal(lon NUMERIC, lat NUMERIC)
RETURNS TABLE(secció_censal VARCHAR, nom_districte VARCHAR, nom_barri VARCHAR) AS $$
SELECT s.secció_censal, s.codi_districte, s.nom_barri
FROM barcelona.seccions_censals s
WHERE ST_Contains(s.geom, ST_SetSRID(ST_Point(lon, lat), 4326))
LIMIT 1;
$$ LANGUAGE SQL;

-- Usage:
SELECT * FROM barcelona.get_secció_censal(2.1734, 41.3851);
```

---

## 7️⃣ Export Results

### Option A: To CSV

```sql
COPY (
    SELECT 
        n_expedient,
        latitud_y,
        longitud_x,
        nom_districte,
        nom_barri,
        secció_censal
    FROM barcelona.habitatges_us_turistic
    WHERE secció_censal IS NOT NULL
) TO '/tmp/points_with_seccions.csv' CSV HEADER;

-- From terminal:
psql -h localhost -U postgres -d cercador_pisos -c "COPY ..." 
mv /tmp/points_with_seccions.csv ./output/
```

### Option B: To GeoJSON

```python
import geopandas as gpd
from sqlalchemy import create_engine

engine = create_engine('postgresql://postgres:password@localhost/cercador_pisos')

query = """
SELECT 
    n_expedient,
    secció_censal,
    nom_districte,
    nom_barri,
    ST_AsText(geom) as geometry
FROM barcelona.habitatges_us_turistic
WHERE secció_censal IS NOT NULL
"""

gdf = gpd.read_postgis(query, engine, geom_col='geometry')
gdf.to_file('output/points_with_seccions.geojson', driver='GeoJSON')

print(f"✅ Exported {len(gdf)} points to GeoJSON")
```

---

## Troubleshooting

### Points not matching?

```sql
-- Check if data loaded correctly
SELECT COUNT(*) FROM barcelona.seccions_censals;

-- Check if any points are outside Barcelona boundaries
SELECT COUNT(*) as outside_barcelona
FROM barcelona.habitatges_us_turistic h
WHERE h.geom IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM barcelona.seccions_censals s 
    WHERE ST_Contains(s.geom, h.geom)
  );
```

### Slow queries?

```sql
-- Check indexes exist
SELECT * FROM pg_indexes 
WHERE tablename = 'seccions_censals';

-- If not using GIST, recreate index
DROP INDEX IF EXISTS idx_seccions_geom;
CREATE INDEX idx_seccions_geom ON barcelona.seccions_censals USING GIST(geom);
```

### Check progress of bulk UPDATE

```sql
-- In another terminal, while UPDATE is running:
SELECT 
    schemaname,
    tablename,
    indexname,
    size
FROM pg_indexes 
WHERE tablename = 'habitatges_us_turistic';
```

---

## Expected Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Index creation | 1-2 min | One-time |
| Load 8M points | 5-10 min | With COPY |
| Bulk ST_Contains | 15-30 min | Single pass |
| Point lookup | <10ms | After indexing |

---

## Key Commands Reference

```bash
# Login to database
psql -h localhost -U postgres -d cercador_pisos

# Load from shapefile
shp2pgsql -I -S -c data/seccions_censals.shp barcelona.seccions_censals | psql ...

# Monitor query progress
SELECT query, query_start, state FROM pg_stat_activity WHERE state != 'idle';

# Analyze query performance
EXPLAIN ANALYZE SELECT ...

# Backup before bulk operations
pg_dump cercador_pisos > backup.sql
```

---

**Time estimate**: 1-2 hours from start to finished 8M point matching  
**Complexity**: Medium (mostly SQL)  
**Cost**: $0 (open source tools)

✅ **Ready to go!**
