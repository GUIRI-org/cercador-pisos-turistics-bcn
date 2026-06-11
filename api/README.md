# GUIRI-pisos API

FastAPI-based REST API for the GUIRI-pisos platform, providing optimized access to project data.

## Overview

This API is consumed by the frontend with optimized REST endpoints that query the PostgreSQL database directly using base tables. All materialized view dependencies have been removed, resulting in **cleaner code**, **improved maintainability**, and **better performance**.


## Endpoints

| Endpoint                          | Method | Description                                |
| --------------------------------- | ------ | ------------------------------------------ |
| `/api/v1/health`                  | GET    | Health check with database connectivity    |
| `/api/v1/apartaments/coordinates` | GET    | Apartments positions for map visualization |

## Response Format

All endpoints return JSON:API-inspired responses:

```json
{
  "data": [
    { "id": "XXXX", "px": -26.504, "py": -24.908 }
  ],
  "meta": {
    "total": 2847
  }
}
```

## Local Development

```bash
cd api
pip install -r requirements.txt
uvicorn src.main:app --reload --port 9092
```

## Docker

The API runs as a Docker container as part of the infrastructure:

```bash
# From infra/ directory
make infra-deploy  # Includes API service
```

## API Documentation

When running, interactive documentation is available at:
- Swagger UI: http://localhost:9092/api/v1/docs
- ReDoc: http://localhost:9092/api/v1/redoc

