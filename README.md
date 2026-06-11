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

**Setup**

1. Clone and start infrastructure:

```bash
make infra-deploy
```

This launches:
- PostgreSQL database with pre-populated tourist housing data
- Mage data pipeline UI
- Nginx reverse proxy

2. Access services:
- Frontend: http://guiripisos.local:8888
- Mage: http://mage.guiripisos.local:8888
- Database: `localhost:8054` (psql credentials in `infra/.env`)

3. Start frontend dev server (optional):

```bash
cd frontend/observable-framework-app
npm install
npm run dev
```

Then visit http://localhost:3000

## Development

- [Database](#database)
- [Data pipelines](#data-pipelines)
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

Request examples for common operations are stored in `api-collection/OpenData BCN/` using Bruno HTTP format.


## Documentation

- [Database Guide](database/README.md) — Schema, data loading, and queries
- [Infrastructure Setup](infra/README.md) — Docker, networking, and deployment
- [Mage Pipelines](magic/README.md) — Data processing workflows
- [Frontend Development](frontend/observable-framework-app/README.md) — Observable Framework
- [Changelog](CHANGELOG.md) — Version history and features


## Credits

A project by [GUIRI][guiri].

[guiri]: https://www.guiri.org