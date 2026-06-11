# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

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
- Database coordinate normalization script (`02-normalize-address-coordinates.sql`) to resolve conflicting coordinates for same addresses
- Database schema (DDL) for Barcelona tourist housing data with PostGIS geometry support
- CSV data loader script (`load-habitatges-csv.sql`) for importing habitatges_us_turistic dataset
- Database dump auto-restore on container startup for pre-populated data
- Bruno HTTP API collection for OpenData BCN APIs (Cerca territori, Adreces, Illa)
- Observable Framework frontend with geoBCN street address search form (Tipo Vía, Carrer autocomplete, Número)
- Chained tourist housing search in frontend: exact address query (street + number) plus street-only query (type + street)
- Full pagination retrieval for tourist housing endpoint results to display all matches
- Externalized frontend styles into `src/styles.css` with Bootstrap CSS import
- Mage documentation (guidelines and README)
- Infrastructure setup with PostgreSQL, Nginx, and Mage containers

### Changed
- Updated `README.md` with API service information and improved quick start guide
- Enhanced infrastructure setup to include FastAPI service in deployment

### Removed
- Old API collection example queries (replaced with standardized OpenData BCN examples)