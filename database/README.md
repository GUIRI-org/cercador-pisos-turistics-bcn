# 🏢 Database

This folder contains the first version of the database model.

**Table of contents**

- [What data sources are included](#what-data-sources-are-included)
- [Database Schema (DDL)](#database-schema-ddl)
- [Migrations](#migrations)
- [How to load CSV data](#how-to-load-csv-data)
- [How to download the database](#how-to-download-the-database)
- [Connecting to the database instance](#connecting-to-the-database-instance)
- [How the database dump has been generated](#how-the-database-dump-has-been-generated)
- [How the load the database dump manually](#how-the-load-the-database-dump-manually)
- [How to refresh data - Materialized Views](#how-to-refresh-data---materialized-views)

## What data sources are included

{TODO}

## Database Schema (DDL)

{TODO}

Refer to [DDL.md](DDL.md) when you need detailed information about the database structure, table relationships, or when making schema modifications.

## Migrations

Database migrations are SQL scripts that modify the database schema or data. They should be numbered sequentially and documented.

### Available Migrations

1. **`01-restore-dump.sh`** - Initial database restoration from dump file
2. **`02-normalize-address-coordinates.sql`** (2026-06-11) - Normalizes coordinates for addresses with conflicting geocoding results
   - Fixed 292 apartment records across 95 addresses
   - Ensures each unique address has consistent coordinates
   - Strategy: Uses first appearing coordinate (by `n_expedient`) per address
   - **Methodology**: See [METHODOLOGY-coordinate-normalization.md](METHODOLOGY-coordinate-normalization.md) for detailed analysis and implementation process

### Automatic Execution

Migrations are automatically executed during database container initialization via Docker's `docker-entrypoint-initdb.d/` mechanism. Files are executed in alphabetical order:

1. `01-restore-dump.sh` - Restores the database dump
2. `02-normalize-address-coordinates.sql` - Applies coordinate normalization

**Note**: These scripts only run when initializing a fresh database. To apply migrations to an existing database, run them manually or rebuild the container with a fresh volume.

### Running Migrations Manually

To run a migration manually:

```bash
# From the project root
cat database/02-normalize-address-coordinates.sql | docker exec -i guiripisos-pgsql psql -U postgres -d guiripisos -p 8054
```

Or directly:

```bash
docker exec guiripisos-pgsql psql -U postgres -d guiripisos -p 8054 -f /path/to/migration.sql
```

### Rebuilding Database with All Migrations

To rebuild the database and apply all migrations from scratch:

```bash
# From the project root
cd infra

# Stop and remove the database container and volume
make infra-undeploy

# Rebuild and start with fresh database (migrations run automatically)
make infra-deploy
```

This will:
1. Remove the existing database container and volume
2. Create a fresh PostgreSQL container
3. Automatically run `01-restore-dump.sh` (restore database dump)
4. Automatically run `02-normalize-address-coordinates.sql` (normalize coordinates)

## How to download the database

To download the database dump included in this repository (`database/db.sql.gz`), you'll need to [install Git LFS on your computer](https://docs.github.com/en/repositories/working-with-files/managing-large-files/installing-git-large-file-storage).

Git Large File Storage is a different tool than Git and needs to be downloaded and installed separately.

## Connecting to the database instance

1. Download the database credentials from Google Drive. The downloaded text file will have this contain this:

    ````bash
    # The values of the credentials have been masked for security reasons.
    POSTGRES_HOST=**********
    POSTGRES_USER=**********
    POSTGRES_DB=**********
    POSTGRES_PASSWORD=**********
    PG_HOST_PORT=**********
    ````

2. Then, you are ready to connect to the PostgreSQL database.

## How the database dump has been generated

**Note**: You need `pg_dump` and `gzip` installed on your computer to follow this procedure.

**Step 1: Connect to the database server**

Follow the instructions in the [Infrastructure setup instructions](../infra/README.md) to connect to a database server instance, either locally or on a cloud environment.

**Step 2: Generate a new SQL file dump**

Run these commands to generate a new dump file:

**Important**:

- Make sure the new database dump works fine before updating the file in this repository.
- Make sure you have `pg_dump` v17.0 installed to follow this procedure.

```bash
# Navigate to the infra/ folder
cd infra
# Load environment variables
source .env
# Run the `pg_dump` command to generate a new dump
PGPASSWORD=$GLOBAL_DB_PASSWORD pg_dump --verbose --host localhost --port $GLOBAL_DB_PORT --username $GLOBAL_DB_USER --format=p -x $GLOBAL_DB_NAME | gzip > ../database/$GLOBAL_DB_NAME.sql.gz
```

## How the load the database dump manually

You can load the database dump directly from the command line.

```bash
# Load the environment variables and load the database dump
source .env
gunzip -c ../database/$GLOBAL_DB_NAME.sql.gz | PGPASSWORD=$GLOBAL_DB_PASSWORD psql -h localhost -p $GLOBAL_DB_PORT -U $GLOBAL_DB_USER -d $GLOBAL_DB_NAME
```

Use the `f` flag to load an uncompressed file directly:

```bash
source .env
PGPASSWORD=$GLOBAL_DB_PASSWORD psql -h localhost -p $GLOBAL_DB_PORT -U $GLOBAL_DB_USER -f database/$GLOBAL_DB_NAME.sql
```



## How to load CSV data from the Open Data BCN dataaset

Load the tourist housing CSV data into the `barcelona.habitatges_us_turistic` table.

Obtained from https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatges-us-turistic.



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
  -f /data/raw/habitatges-us-turistic/load-habitatges-csv.sql
```

The script reads from `data/raw/habitatges-us-turistic/hut_comunicacio_opendata.csv` and imports it with geographic points computed from coordinates.
