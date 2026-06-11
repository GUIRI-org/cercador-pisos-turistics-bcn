"""
GUIRI Apartaments API - FastAPI application for serving project data.

This API provides REST endpoints to access GUIRI Apartaments data for frontend consumption.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings
from .routers import health, apartments


# Endpoints to cache (7 days = 604,800 seconds)
# These endpoints return data that changes only 1-2 times per year
# NOTE: only static paths cache here. Parameterized routes (e.g.
# /apartaments/{id}
# can stay a simple set lookup; cache them via a CDN if needed.
CACHEABLE_ENDPOINTS = {
    "/api/v1/apartments",
}
CACHE_MAX_AGE = 604800  # 7 days in seconds


class CacheControlMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add Cache-Control headers to cacheable API endpoints.
    
    For static data endpoints (project lists, coordinates, etc.), this enables
    browser caching for 90 days, dramatically reducing repeat load times.
    """
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Only cache GET requests to specific endpoints
        if request.method == "GET" and request.url.path in CACHEABLE_ENDPOINTS:
            response.headers["Cache-Control"] = f"public, max-age={CACHE_MAX_AGE}"
        
        return response


app = FastAPI(
    title="GUIRI Apartaments API",
    description="REST API for GUIRI Apartaments platform data",
    version="0.1.0",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json"
)

# Cache-Control headers for static data endpoints
app.add_middleware(CacheControlMiddleware)

# GZip compression for responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(apartments.router, prefix="/api/v1", tags=["Apartments"])

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "GUIRI Apartaments API",
        "version": "0.1.0",
        "docs": "/api/v1/docs"
    }
