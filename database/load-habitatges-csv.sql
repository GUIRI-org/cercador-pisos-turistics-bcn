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

-- Fix apartments with missing neighborhood codes (codi_barri and nom_barri)
-- Based on analysis of similar entries on the same streets or geographic proximity

-- 1. Carrer BRUC #151 - District 2: Assign to "la Dreta de l'Eixample" (barri 7)
--    Based on 50 similar addresses on the same street
UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 7,
    nom_barri = 'la Dreta de l''Eixample',
    updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '02-2010-0863'
  AND codi_barri IS NULL;

-- 2. Carrer CABANES #21 - District 3: Assign to "el Poble Sec" (barri 11)
--    Based on 5 similar addresses on the same street
UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 11,
    nom_barri = 'el Poble Sec',
    updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '03-2014-0406'
  AND codi_barri IS NULL;

-- 3. Carrer EST #19 - District 1: Assign to "el Raval" (barri 1)
--    Based on 10 similar addresses on the same street
UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 1,
    nom_barri = 'el Raval',
    updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '01-2022-0365'
  AND codi_barri IS NULL;

-- 4. Passeig de Gràcia #115 - District 6: Assign to "la Vila de Gràcia" (barri 31)
--    Based on 13 apartments at the same address
UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 31,
    nom_barri = 'la Vila de Gràcia',
    updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '06-2008-0259'
  AND codi_barri IS NULL;

-- 5. Passeig Sant Antoni #30 - District 3: Assign to "Sants" (barri 18)
--    Based on 31 apartments at the same address
UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 18,
    nom_barri = 'Sants',
    updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '03-2009-0168'
  AND codi_barri IS NULL;

-- 6. Carrer Tirso de Molina #14 - District 3: Assign to "Sants" (barri 18)
--    Based on geographic proximity (10 nearest neighbors all in Sants)
UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 18,
    nom_barri = 'Sants',
    updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '03-2013-0028'
  AND codi_barri IS NULL;

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
