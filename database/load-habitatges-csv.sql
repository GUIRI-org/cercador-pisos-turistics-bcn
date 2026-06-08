-- Load CSV data into barcelona.habitatges_us_turistic table
-- This script imports the hut_comunicacio_opendata.csv file into PostgreSQL
-- 
-- Usage:
--   psql -h <host> -p <port> -U <user> -d <database> -f load-habitatges-csv.sql
--
-- Or with environment variables from .env:
--   psql -h localhost -p 8054 -U postgres -d guiripisos -f load-habitatges-csv.sql
--
-- Example from within a Docker container:
--   psql -h guiripisos-pgsql -p 5432 -U postgres -d guiripisos -f load-habitatges-csv.sql

-- Set search path
SET search_path TO barcelona, public;

-- Create temporary table for importing CSV data
CREATE TEMPORARY TABLE temp_habitatges (
    n_expedient VARCHAR(20),
    codi_districte SMALLINT,
    nom_districte VARCHAR(100),
    codi_barri SMALLINT,
    nom_barri VARCHAR(100),
    tipus_carrer VARCHAR(50),
    carrer VARCHAR(150),
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
    latitud_y NUMERIC(12, 10)
);

-- Load CSV file into temporary table
\COPY temp_habitatges FROM '../data/interim/hut_comunicacio_opendata.csv' WITH (FORMAT csv, HEADER true, DELIMITER ',', NULL '', ENCODING 'UTF8')

-- Insert data from temporary table into main table, computing the geom column
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
    CASE 
        WHEN longitud_x IS NOT NULL AND latitud_y IS NOT NULL
        THEN ST_GeomFromText('POINT(' || longitud_x || ' ' || latitud_y || ')', 4326)
        ELSE NULL
    END AS geom,
    2026 AS year_updated,
    '1T' AS quarter_updated,
    1 AS dataset_id
FROM temp_habitatges
ON CONFLICT (n_expedient) DO UPDATE SET
    codi_districte = EXCLUDED.codi_districte,
    nom_districte = EXCLUDED.nom_districte,
    codi_barri = EXCLUDED.codi_barri,
    nom_barri = EXCLUDED.nom_barri,
    tipus_carrer = EXCLUDED.tipus_carrer,
    carrer = EXCLUDED.carrer,
    tipus_num = EXCLUDED.tipus_num,
    num1 = EXCLUDED.num1,
    lletra1 = EXCLUDED.lletra1,
    num2 = EXCLUDED.num2,
    lletra2 = EXCLUDED.lletra2,
    bloc = EXCLUDED.bloc,
    portal = EXCLUDED.portal,
    escala = EXCLUDED.escala,
    pis = EXCLUDED.pis,
    porta = EXCLUDED.porta,
    numero_registre_generalitat = EXCLUDED.numero_registre_generalitat,
    numero_places = EXCLUDED.numero_places,
    longitud_x = EXCLUDED.longitud_x,
    latitud_y = EXCLUDED.latitud_y,
    geom = EXCLUDED.geom,
    year_updated = EXCLUDED.year_updated,
    quarter_updated = EXCLUDED.quarter_updated,
    updated_at = CURRENT_TIMESTAMP;

-- Print summary statistics
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT codi_districte) as total_districts,
    COUNT(DISTINCT codi_barri) as total_neighborhoods,
    MIN(year_updated) as min_year,
    MAX(year_updated) as max_year,
    SUM(numero_places) as total_tourist_places
FROM barcelona.habitatges_us_turistic;

-- Clean up temporary table
DROP TABLE IF EXISTS temp_habitatges;
