# Cercador de Pisos Turístics Barcelona

Search and explore tourist housing licenses across Barcelona neighborhoods using open data from the Barcelona City Council.

**Table of Contents**

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Development](#development)
- [API Collection](#api-collection)
- [Documentation](#documentation)
- [Credits](#credits)

## Overview

This project provides tools and interfaces to explore Barcelona's tourist housing dataset. It combines:

- **Database**: PostgreSQL with PostGIS for geographic data
- **ETL Pipeline**: Mage for data processing and transformation
- **Frontend**: Observable Framework for interactive exploration
- **APIs**: Integration with Barcelona's GeoBCN service for address lookup

Data source: [Barcelona Open Data — Viviendas de uso turístico](https://opendata-ajuntament.barcelona.cat/data/es/dataset/habitatges-us-turistic)

## Quick Start

The `infra/` folder contains all necessary resources to run the components of the platform using Docker on an empty host: your computer or a server in the cloud. -- [How to set up the platform](./infra/README.md).

**Prerequisites**

- Docker and Docker Compose
- Git
- [Git LFS](https://git-lfs.github.com/) — the dataset CSV is stored in LFS

  ```bash
  # macOS
  brew install git-lfs
  git lfs install
  ```

**Setup**

1. Pull the dataset file from Git LFS:

```bash
git lfs pull
```

> If you skip this step the database will initialise with an empty table and all API calls will return 0 results.

2. Add the local domains to `/etc/hosts` so the browser can resolve them:

```bash
sudo sh -c 'echo "127.0.0.1 guiripisos.local api.guiripisos.local mage.guiripisos.local" >> /etc/hosts'
```

3. Clone and start infrastructure:

```bash
make infra-deploy
```

This launches:
- PostgreSQL database with pre-populated tourist housing data
- FastAPI REST API for data access
- Mage data pipeline UI
- Nginx reverse proxy

4. Access services:
- Frontend: http://guiripisos.local:8888
- API: http://api.guiripisos.local:8888/api/v1/docs
- Mage: http://mage.guiripisos.local:8888
- Database: `localhost:8054` (psql credentials in `infra/.env`)

5. Start frontend dev server (optional):

```bash
cd frontend/observable-framework-app
npm install
npm run dev
```

Then visit http://localhost:3000

## Development

- [Database](#database)
- [Data pipelines](#data-pipelines)
- [API](#api)
- [Frontend](#frontend)


### Database

Manage the PostgreSQL schema and data:

- **Schema definition**: [database/DDL.md](database/DDL.md)
- **Data import (basic)**: [database/load-habitatges-csv.sql](database/load-habitatges-csv.sql)
- **Setup details**: [database/README.md](database/README.md)

### Data Pipelines

Data transformation and ETL workflows are defined in `magic/mage-guiripisos/pipelines/`.

Access the UI at http://mage.guiripisos.local:8888 when infrastructure is running.

See [magic/README.md](magic/README.md) for details.

### API

FastAPI REST service providing programmatic access to the tourist housing database.

**Endpoints:**

- `GET /api/v1/apartments/map` — All apartments (no pagination) for map visualization
- `GET /api/v1/apartments/search` — Search apartments by address or location criteria
- `GET /api/v1/apartments/districts` — List all districts with apartment counts
- `GET /api/v1/apartments/neighborhoods` — List all neighborhoods with apartment counts
- `GET /api/v1/health` — Service health check

**Response Format:**

```json
{
  "data": [...],
  "meta": {
    "total": 12345
  }
}
```

**Search Parameters:**

- Address: `tipus_carrer`, `carrer`, `num1`
- Location: `codi_districte`, `nom_districte`, `codi_barri`, `nom_barri`
- Registration: `numero_registre_generalitat`

All search filters are optional and support combining. Text fields use case-insensitive partial matching.

**Local Development:**

```bash
cd api
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8001
```

API documentation available at http://localhost:8001/api/v1/docs

### Frontend

Observable Framework application with interactive data exploration and geoBCN address search.

```bash
cd frontend/observable-framework-app
npm run dev          # Start dev server
npm run build        # Build static site
npm run deploy       # Deploy to Observable
```

See [frontend/observable-framework-app/README.md](frontend/observable-framework-app/README.md) for details.

## API Collection

The `api-collection/` directory contains HTTP request examples:

- **OpenData BCN**: Examples for Barcelona Open Data API integration (address lookup, territory search)
- **GUIRI Apartments**: Examples for the local REST API endpoints

Collection format: [Bruno](https://www.usebruno.com/) — a git-friendly HTTP client


## Documentation

- [Database Guide](database/README.md) — Schema, data loading, and queries
- [Infrastructure Setup](infra/README.md) — Docker, networking, and deployment
- [Mage Pipelines](magic/README.md) — Data processing workflows
- [Frontend Development](frontend/observable-framework-app/README.md) — Observable Framework
- [Changelog](CHANGELOG.md) — Version history and features


## Credits

A project by [GUIRI][guiri].

[guiri]: https://www.guiri.org