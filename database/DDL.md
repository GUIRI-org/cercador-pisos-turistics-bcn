# DDL - Barcelona Housing Database Schema

## Dataset Information
- **Source**: https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatges-us-turistic
- **Title**: Viviendas de uso turístico de la ciudad de Barcelona
- **Schema**: barcelona

---

## Schema

```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create schema
CREATE SCHEMA IF NOT EXISTS barcelona;

-- Set search path
SET search_path TO barcelona, public;

-- Create table
CREATE TABLE barcelona.habitatges_us_turistic (
    n_expedient VARCHAR(20) PRIMARY KEY,
    codi_districte SMALLINT ,
    nom_districte VARCHAR(100) ,
    codi_barri SMALLINT ,
    nom_barri VARCHAR(100) ,
    tipus_carrer VARCHAR(50),
    carrer VARCHAR(150) ,
    tipus_num SMALLINT,
    num1 INTEGER,
    lletra1 VARCHAR(1),
    num2 INTEGER,
    lletra2 VARCHAR(1),
    bloc VARCHAR(10),
    portal VARCHAR(10),
    escala VARCHAR(10),
    pis VARCHAR(10),
    porta VARCHAR(10),
    numero_registre_generalitat VARCHAR(20),
    numero_places SMALLINT,
    longitud_x NUMERIC(12, 10),
    latitud_y NUMERIC(12, 10),
    geom GEOMETRY(Point, 4326),
    year_updated SMALLINT,
    quarter_updated VARCHAR(2),
    dataset_id INTEGER,
    created_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_habitatges_numero_registre 
    ON barcelona.habitatges_us_turistic(numero_registre_generalitat);

CREATE INDEX idx_habitatges_coordinates 
    ON barcelona.habitatges_us_turistic(longitud_x, latitud_y);

CREATE INDEX idx_habitatges_geom 
    ON barcelona.habitatges_us_turistic USING GIST(geom);

CREATE INDEX idx_habitatges_ubicacio 
    ON barcelona.habitatges_us_turistic(codi_districte, codi_barri);

CREATE INDEX idx_habitatges_carrer 
    ON barcelona.habitatges_us_turistic(carrer);

CREATE INDEX idx_habitatges_metadata 
    ON barcelona.habitatges_us_turistic(year_updated, quarter_updated, dataset_id);

```

---

## Constraints Summary

| Constraint  | Type    | Column(s)                                                                                                                            |
| ----------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Primary Key | PK      | n_expedient                                                                                                                          |
|     | NN      | codi_districte, nom_districte, codi_barri, nom_barri, carrer, year_updated, quarter_updated, dataset_id, created_at, updated_at |
| Default     | DEFAULT | created_at = CURRENT_TIMESTAMP                                                                                                       |
| Default     | DEFAULT | updated_at = CURRENT_TIMESTAMP                                                                                                       |

---

## Column Descriptions

| Column                      | Data Type       | Description                                                         |
| --------------------------- | --------------- | ------------------------------------------------------------------- |
| n_expedient                 | VARCHAR(20)     | Unique case number (Primary Key)                                    |
| codi_districte              | SMALLINT        | District code                                                       |
| nom_districte               | VARCHAR(100)    | District name                                                       |
| codi_barri                  | SMALLINT        | Neighborhood code                                                   |
| nom_barri                   | VARCHAR(100)    | Neighborhood name                                                   |
| tipus_carrer                | VARCHAR(50)     | Street type (Carrer, Plaça, Passatge, etc.)                         |
| carrer                      | VARCHAR(150)    | Street name                                                         |
| tipus_num                   | SMALLINT        | Number type                                                         |
| num1                        | INTEGER         | Primary street number                                               |
| lletra1                     | VARCHAR(1)      | Letter suffix for primary number                                    |
| num2                        | INTEGER         | Secondary street number                                             |
| lletra2                     | VARCHAR(1)      | Letter suffix for secondary number                                  |
| bloc                        | VARCHAR(10)     | Building block                                                      |
| portal                      | VARCHAR(10)     | Portal/entrance number                                              |
| escala                      | VARCHAR(10)     | Staircase identifier                                                |
| pis                         | VARCHAR(10)     | Floor number (can be numeric, PR for ground, BJ for basement, etc.) |
| porta                       | VARCHAR(10)     | Door/unit number                                                    |
| numero_registre_generalitat | VARCHAR(20)     | Official registration number (Unique Key)                           |
| numero_places               | SMALLINT        | Number of tourist places/beds                                       |
| longitud_x                  | NUMERIC(12, 10) | Geographic longitude (WGS84) - raw data from CSV                    |
| latitud_y                   | NUMERIC(12, 10) | Geographic latitude (WGS84) - raw data from CSV                     |
| geom                        | GEOMETRY(Point, 4326) | Geographic point (PostGIS, WGS84 SRID: 4326)                   |
| year_updated                | SMALLINT        | Year of data update (default: 2026)                                 |
| quarter_updated             | VARCHAR(2)      | Quarter of data update (default: '1T')                              |
| dataset_id                  | INTEGER         | Dataset identifier                                                  |
| created_at                  | TIMESTAMP       | Record creation timestamp                                           |
| updated_at                  | TIMESTAMP       | Record last update timestamp                                        |

---

## Data Loading Notes

### Converting Coordinates to PostGIS Geometry

The table stores both raw coordinates (`longitud_x`, `latitud_y`) from the CSV and a PostGIS geometry point (`geom`). When loading data, populate both:

```sql
-- During import, create the point from raw coordinates:
INSERT INTO barcelona.habitatges_us_turistic (
    n_expedient, codi_districte, nom_districte, codi_barri, nom_barri,
    tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2,
    bloc, portal, escala, pis, porta, numero_registre_generalitat,
    numero_places, longitud_x, latitud_y, geom, year_updated, quarter_updated, dataset_id
)
SELECT
    n_expedient, codi_districte, nom_districte, codi_barri, nom_barri,
    tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2,
    bloc, portal, escala, pis, porta, numero_registre_generalitat,
    numero_places, longitud_x, latitud_y,
    ST_GeomFromText('POINT(' || longitud_x || ' ' || latitud_y || ')', 4326),
    2026, '1T', 1
FROM csv_import_table;
```

### Useful PostGIS Queries

```sql
-- Find records within a certain distance (in meters) from a point
SELECT * FROM barcelona.habitatges_us_turistic
WHERE ST_DWithin(geom, ST_GeomFromText('POINT(2.17 41.38)', 4326), 1000);

-- Find records within a bounding box
SELECT * FROM barcelona.habitatges_us_turistic
WHERE geom && ST_MakeEnvelope(2.15, 41.37, 2.20, 41.39, 4326);

-- Calculate distance between two points (in meters)
SELECT n_expedient, ST_Distance(geom, ST_GeomFromText('POINT(2.17 41.38)', 4326)) as distance_m
FROM barcelona.habitatges_us_turistic
ORDER BY distance_m
LIMIT 10;
```


