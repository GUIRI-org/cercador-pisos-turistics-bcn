-- DDL - Barcelona Housing Database Schema
-- Creates the schema, table, and all necessary indexes
-- Source: https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatges-us-turistic

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
