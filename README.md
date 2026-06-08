# Cercador de Pisos Turístics Barcelona

Search and explore tourist housing licenses across Barcelona neighborhoods using open data from the Barcelona City Council.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Architecture](#architecture)
- [External APIs](#external-apis)
- [Documentation](#documentation)

## Overview

This project provides tools and interfaces to explore Barcelona's tourist housing dataset. It combines:

- **Database**: PostgreSQL with PostGIS for geographic data
- **ETL Pipeline**: Mage for data processing and transformation
- **Frontend**: Observable Framework for interactive exploration
- **APIs**: Integration with Barcelona's GeoBCN service for address lookup

Data source: [Barcelona Open Data — Viviendas de uso turístico](https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatges-us-turistic)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Setup

1. Clone and start infrastructure:

```bash
make infra-deploy
```

This launches:
- PostgreSQL database with pre-populated tourist housing data
- Mage data pipeline UI
- Nginx reverse proxy

2. Access services:
- **Frontend**: http://guiripisos.local:8888
- **Mage**: http://mage.guiripisos.local:8888
- **Database**: `localhost:8054` (psql credentials in `infra/.env`)

3. Start frontend dev server (optional):

```bash
cd frontend/observable-framework-app
npm install
npm run dev
```

Then visit http://localhost:3000

## Project Structure

```
├── database/                  # Schema and data loading
│   ├── DDL.md                # Table definitions
│   ├── load-habitatges-csv.sql
│   └── README.md
├── infra/                     # Docker infrastructure
│   ├── .env                  # Database and service credentials
│   ├── compose-*.yaml        # Service definitions
│   └── Makefile
├── api-collection/            # HTTP request examples (Bruno)
│   └── OpenData BCN/
├── frontend/                  # Observable Framework app
│   └── observable-framework-app/
├── magic/                     # Mage configuration and pipelines
│   └── mage-guiripisos/
└── data/                      # Data directories (raw, processed, external)
    └── raw/
        └── habitatges-us-turistic/  # CSV data files
```

## Development

### Database

Manage the PostgreSQL schema and data:

- **Schema definition**: [database/DDL.md](database/DDL.md)
- **Data import**: [database/load-habitatges-csv.sql](database/load-habitatges-csv.sql)
- **Setup details**: [database/README.md](database/README.md)

To reload data manually:

```bash
cd infra
source .env
PGPASSWORD=$GLOBAL_DB_PASSWORD psql \
  -h localhost -p $GLOBAL_DB_PORT -U $GLOBAL_DB_USER -d $GLOBAL_DB_NAME \
  -f ../database/load-habitatges-csv.sql
```

### Mage Pipelines

Data transformation and ETL workflows are defined in `magic/mage-guiripisos/pipelines/`.

Access the UI at http://mage.guiripisos.local:8888 when infrastructure is running.

See [magic/README.md](magic/README.md) for details.

### Frontend

Observable Framework application with interactive data exploration and geoBCN address search.

```bash
cd frontend/observable-framework-app
npm run dev          # Start dev server
npm run build        # Build static site
npm run deploy       # Deploy to Observable
```

See [frontend/observable-framework-app/README.md](frontend/observable-framework-app/README.md) for details.

## Architecture

```
┌─────────────────────────────────────────────┐
│          Browser / Frontend Client          │
│  (Observable Framework - http://localhost)  │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│      Nginx Reverse Proxy (port 8888)        │
│  Routes: guiripisos.local → Frontend        │
│          mage.guiripisos.local → Mage       │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴────────┐
        ↓                 ↓
┌──────────────────┐  ┌──────────────────────┐
│  Mage Pipeline   │  │  PostgreSQL Database │
│  (Data ETL)      │  │  (PostGIS, Barcelona │
│  (port 9000)     │  │   housing dataset)   │
└──────────────────┘  └──────────────────────┘
        │
        ↓
┌──────────────────────────────────────────────┐
│   External APIs (GeoBCN Street Search)       │
└──────────────────────────────────────────────┘
```

## External APIs

### GeoBCN — Street Address Search

Provides Barcelona street data and address lookups.

**Base URL**: `https://geoportal.barcelona.cat/geoBCN/serveis/territori`

| Endpoint | Description |
|----------|-------------|
| `GET /tipusvies` | Street types (code, abbreviation, name) |
| `GET /?q={query}` | Full-text search for streets and addresses |
| `GET /portals?id_via={id}&numero={num}` | Door-level details for street/number |

**Example**:

```bash
curl "https://geoportal.barcelona.cat/geoBCN/serveis/territori?q=aribau"
```

Response:

```json
{
  "estat": "OK",
  "resultats": {
    "vies": [
      {
        "codi": "023403",
        "nomComplet": "Carrer d'Aribau",
        "tipusVia": { "codi": "02", "abreviatura": "C", "nom": "Carrer" }
      }
    ],
    "adreces": [
      {
        "id": "...",
        "carrer": { "codi": "023403" },
        "numeracioPostal": "1",
        "nomComplet": "Carrer d'Aribau 1",
        "barri": {...},
        "districte": {...}
      }
    ]
  }
}
```

**Docs**: https://geoportal.barcelona.cat/geoBCN/doc/rest/API.aspx

### API Collection

Request examples for common operations are stored in `api-collection/OpenData BCN/` using Bruno HTTP format:

- **Cerca territori** — Full-text search
- **Adreces** — Address details lookup
- **Illa** — Neighborhood/block information

Import into [Bruno](https://www.usebruno.com/) and configure environment variables in `api-collection/OpenData BCN/environments/default.yml`.

## Documentation

- [Database Guide](database/README.md) — Schema, data loading, and queries
- [Infrastructure Setup](infra/README.md) — Docker, networking, and deployment
- [Mage Pipelines](magic/README.md) — Data processing workflows
- [Frontend Development](frontend/observable-framework-app/README.md) — Observable Framework
- [Changelog](CHANGELOG.md) — Version history and features
