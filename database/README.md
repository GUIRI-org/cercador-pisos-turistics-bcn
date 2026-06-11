# 🏢 Database

This folder contains the database schema and initialization scripts.

## Overview

The database uses a **CSV-based initialization approach**:
- DDL scripts create the schema and tables
- CSV data is loaded directly from `data/interim/hut_comunicacio_opendata.csv`
- Normalization scripts ensure data quality

This approach provides transparency, version control, and eliminates the need for large binary dump files.

**Table of contents**

- [Overview](#overview)
- [Database Schema (DDL)](#database-schema-ddl)
- [Database Initialization](#database-initialization)
- [Data Management](#data-management)
- [Connecting to the database instance](#connecting-to-the-database-instance)
- [How to load CSV data manually](#how-to-load-csv-data-manually)
- [How to export database dump (optional)](#how-to-export-database-dump-optional)

## Database Schema (DDL)

The database schema is defined in [DDL.md](DDL.md). It includes:
- PostGIS-enabled spatial database
- `barcelona.habitatges_us_turistic` table with all tourist housing data
- Indexes for efficient querying (spatial, coordinates, locations)

Refer to [DDL.md](DDL.md) for detailed information about the database structure, table relationships, and column descriptions.

## Database Initialization

Database initialization scripts create and populate the database from scratch. They are numbered sequentially and executed automatically during container startup.

### Initialization Scripts

The database is initialized using the following scripts (executed in order):

1. **`01-create-schema.sql`** - Creates the database schema, tables, and indexes
   - Enables PostGIS extension
   - Creates `barcelona` schema
   - Creates `habitatges_us_turistic` table with all columns
   - Creates all necessary indexes (geom, coordinates, locations, etc.)

2. **`02-load-data.sql`** (mapped to `load-habitatges-csv.sql`) - Loads CSV data into the database
   - Imports data from `/data/hut_comunicacio_opendata.csv`
   - Creates temporary staging table
   - Inserts records with proper geometry calculation
   - Handles conflicts with UPSERT logic

3. **`03-normalize-address-coordinates.sql`** (2026-06-11) - Normalizes coordinates for addresses with conflicting geocoding results
   - Fixed 292 apartment records across 95 addresses
   - Ensures each unique address has consistent coordinates
   - Strategy: Uses first appearing coordinate (by `n_expedient`) per address
   - **Methodology**: See [METHODOLOGY-coordinate-normalization.md](METHODOLOGY-coordinate-normalization.md) for detailed analysis and implementation process

### Automatic Execution

Initialization scripts are automatically executed during database container initialization via Docker's `docker-entrypoint-initdb.d/` mechanism. Files are executed in alphabetical order.

**Note**: These scripts only run when initializing a fresh database. To apply changes to an existing database, run them manually or rebuild the container with a fresh volume.

### Running Initialization Scripts Manually

To run an initialization script manually on an existing database:

```bash
# From the project root
cat database/01-create-schema.sql | docker exec -i guiripisos-pgsql psql -U postgres -d guiripisos -p 8054

cat database/load-habitatges-csv.sql | docker exec -i guiripisos-pgsql psql -U postgres -d guiripisos -p 8054

cat database/02-normalize-address-coordinates.sql | docker exec -i guiripisos-pgsql psql -U postgres -d guiripisos -p 8054
```

### Rebuilding Database from Scratch

To rebuild the database and initialize it from scratch with all scripts:

```bash
# From the project root
cd infra

# Stop and remove the database container and volume
make infra-undeploy

# Rebuild and start with fresh database (initialization scripts run automatically)
make infra-deploy
```

This will:
1. Remove the existing database container and volume
2. Create a fresh PostgreSQL container
3. Automatically run `01-create-schema.sql` (create tables and indexes)
4. Automatically run `02-load-data.sql` (load CSV data)
5. Automatically run `03-normalize-address-coordinates.sql` (normalize coordinates)

## Data Management

The database is initialized from CSV data files located in `data/interim/`. The initialization process automatically creates the schema, loads the data, and applies normalization scripts.
### CSV-Based Approach

The database uses a **CSV-based initialization approach** instead of binary dump files:

**Benefits:**
- ✅ Version control friendly (text files, not binary)
- ✅ Transparent and auditable
- ✅ Easy to understand and modify
- ✅ Smaller repository size
- ✅ Direct traceability to source data

### Data Source

**Primary file:** `data/interim/hut_comunicacio_opendata.csv`

This file contains consolidated tourist housing data for Barcelona from:
- **Source:** [Open Data BCN - Habitatges d'ús turístic](https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatges-us-turistic)
- **Description:** Tourist housing registry for Barcelona city

The CSV file is automatically loaded during database initialization with proper PostGIS geometry calculation
For more information about the database structure, refer to [DDL.md](DDL.md).

## Connecting to the da manually

The CSV data is **automatically loaded** during database initialization. Manual loading is only needed for data refresh or troubleshooting:

    ````bash
    # The values of the credentials have been masked for security reasons.
    POSTGRES_HOST=**********
    POSTGRES_USER=**********
    POSTGRES_DB=**********
    POSTGRES_PASSWORD=**********
    PG_HOST_PORT=**********
    ````

2. Then, you are ready to connect to the PostgreSQL database.

## How to load CSV data

The CSV data is automatically loaded during database initialization. If you need to manually reload the data:

```bash
cd infra
source .env

PGPASSWORD=$GLOBAL_DB_PASSWORD psql \
  -h localhost \
  -p $GLOBAL_DB_PORT \
  -U $GLOBAL_DB_USER \
  -d $GLOBAL_DB_NAME \
  -f ../database/load-habitatges-csv.sql
```

Or from a Docker container:

```bash
cd infra
source .env

docker exec $DB_CONTAINER_NAME psql \
  -h localhost \
  -p 5432 \
  -U $GLOBAL_DB_USER \
  -d $GLOBAL_DB_NAME \
  -f /docker-entrypoint-initdb.d/02-load-data.sql
```

The script reads from `/data/hut_comunicacio_opendata.csv` (mounted from `data/interim/hut_comunicacio_opendata.csv`) and imports it with geographic points computed from coordinates.

Data source: https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatges-us-turistic

## How to export database dump (optional)

If you need to create a backup dump of the database:

**Note**: You need `pg_dump` and `gzip` installed on your computer to follow this procedure.

```bash
# Navigate to the infra/ folder
cd infra
# Load environment variables
source .env
# Run the `pg_dump` command to generate a new dump
PGPASSWORD=$GLOBAL_DB_PASSWORD pg_dump --verbose --host localhost --port $GLOBAL_DB_PORT --username $GLOBAL_DB_USER --format=p -x $GLOBAL_DB_NAME | gzip > ../database/$GLOBAL_DB_NAME.sql.gz
```

To load a dump file manually:

```bash
# Load the environment variables and load the database dump
source .env
gunzip -c ../database/$GLOBAL_DB_NAME.sql.gz | PGPASSWORD=$GLOBAL_DB_PASSWORD psql -h localhost -p $GLOBAL_DB_PORT -U $GLOBAL_DB_USER -d $GLOBAL_DB_NAME
```
