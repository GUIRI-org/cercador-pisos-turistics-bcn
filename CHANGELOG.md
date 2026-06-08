# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added
- Database schema (DDL) for Barcelona tourist housing data with PostGIS geometry support
- CSV data loader script (`load-habitatges-csv.sql`) for importing habitatges_us_turistic dataset
- Database dump auto-restore on container startup for pre-populated data
- Bruno HTTP API collection for OpenData BCN APIs (Cerca territori, Adreces, Illa)
- Observable Framework frontend with geoBCN street address search form (Tipo Vía, Carrer autocomplete, Número, Piso, Escalera, Puerta)
- Mage documentation (guidelines and README)
- Infrastructure setup with PostgreSQL, Nginx, and Mage containers

### Removed
- Old API collection example queries (replaced with standardized OpenData BCN examples)