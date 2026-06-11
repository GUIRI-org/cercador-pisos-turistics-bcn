# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added
- **FastAPI REST API** (`api/`) for serving GUIRI Apartaments data to frontend
  - `/api/v1/apartments` - List all apartments with optional filtering by district/neighborhood
  - `/api/v1/apartments/map` - Optimized apartment coordinates for map visualization
  - `/api/v1/apartments/districts` - List all districts with apartment counts
  - `/api/v1/apartments/neighborhoods` - List all neighborhoods with apartment counts
  - `/api/v1/apartments/{n_expedient}` - Get single apartment by case number
  - `/api/v1/health` - Health check endpoint with database connectivity
  - CORS middleware for frontend integration
  - GZip compression for API responses
  - Cache-Control headers (7-day TTL) for static endpoints
  - Dockerized deployment with `compose-api.yaml`
- **Bruno API collection** for GUIRI Apartments API endpoints (`api-collection/GUIRI Apartments/`)
  - Apartments map query
  - Search by district
  - Search by neighborhood
  - Search by address
  - Districts list
  - Neighborhoods list
  - localhost environment configuration
- **CSV-based database initialization** approach (replacing dump-based method)
  - `database/01-create-schema.sql` - DDL script for creating schema, tables, and indexes
  - Automatic CSV data loading from `data/interim/hut_comunicacio_opendata.csv`
  - Sequential initialization scripts via Docker `docker-entrypoint-initdb.d/`
- Database coordinate normalization script (`02-normalize-address-coordinates.sql`) to resolve conflicting coordinates for same addresses
- Database schema (DDL) for Barcelona tourist housing data with PostGIS geometry support
- CSV data loader script (`load-habitatges-csv.sql`) for importing habitatges_us_turistic dataset
- Bruno HTTP API collection for OpenData BCN APIs (Cerca territori, Adreces, Illa)
- Observable Framework frontend with geoBCN street address search form (Tipo Vía, Carrer autocomplete, Número)
- Chained tourist housing search in frontend: exact address query (street + number) plus street-only query (type + street)
- Full pagination retrieval for tourist housing endpoint results to display all matches
- Externalized frontend styles into `src/styles.css` with Bootstrap CSS import
- Mage documentation (guidelines and README)
- Infrastructure setup with PostgreSQL, Nginx, and Mage containers

### Changed
- **Database initialization architecture**: Migrated from dump-based to CSV-based approach
  - `infra/compose-db.yaml`: Updated volume mounts to use DDL + CSV files instead of dump file
  - `database/load-habitatges-csv.sql`: Updated CSV path for Docker container compatibility (`/data/hut_comunicacio_opendata.csv`)
  - `database/README.md`: Comprehensive documentation rewrite explaining CSV-based initialization benefits
- Updated `README.md` with API service information and improved quick start guide
- Enhanced infrastructure setup to include FastAPI service in deployment

### Removed
- `database/01-restore-dump.sh` - Shell script for restoring database dumps (replaced by DDL approach)
- `database/guiripisos.sql.gz` - Binary database dump file (replaced by CSV + DDL scripts)
- Old API collection example queries (replaced with standardized OpenData BCN examples)