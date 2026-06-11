"""
Apartments endpoints for the barcelona.habitatges_us_turistic table.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db

router = APIRouter()


# ============================================================================
# Pydantic Models
# ============================================================================

class Apartment(BaseModel):
    """Apartment resource model matching barcelona.habitatges_us_turistic table."""
    
    n_expedient: str = Field(..., description="Unique case number")
    codi_districte: Optional[int] = Field(None, description="District code")
    nom_districte: Optional[str] = Field(None, description="District name")
    codi_barri: Optional[int] = Field(None, description="Neighborhood code")
    nom_barri: Optional[str] = Field(None, description="Neighborhood name")
    tipus_carrer: Optional[str] = Field(None, description="Street type")
    carrer: Optional[str] = Field(None, description="Street name")
    tipus_num: Optional[int] = Field(None, description="Number type")
    num1: Optional[int] = Field(None, description="Primary street number")
    lletra1: Optional[str] = Field(None, description="Letter suffix for primary number")
    num2: Optional[int] = Field(None, description="Secondary street number")
    lletra2: Optional[str] = Field(None, description="Letter suffix for secondary number")
    bloc: Optional[str] = Field(None, description="Building block")
    portal: Optional[str] = Field(None, description="Portal/entrance number")
    escala: Optional[str] = Field(None, description="Staircase identifier")
    pis: Optional[str] = Field(None, description="Floor number")
    porta: Optional[str] = Field(None, description="Door/unit number")
    numero_registre_generalitat: Optional[str] = Field(None, description="Official registration number")
    numero_places: Optional[int] = Field(None, description="Number of tourist places/beds")
    longitud_x: Optional[float] = Field(None, description="Geographic longitude (WGS84)")
    latitud_y: Optional[float] = Field(None, description="Geographic latitude (WGS84)")
    year_updated: Optional[int] = Field(None, description="Year of data update")
    quarter_updated: Optional[str] = Field(None, description="Quarter of data update")
    dataset_id: Optional[int] = Field(None, description="Dataset identifier")
    created_at: Optional[datetime] = Field(None, description="Record creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Record last update timestamp")
    
    class Config:
        from_attributes = True


class ApartmentMeta(BaseModel):
    """Metadata for apartment responses."""
    total: int = Field(..., description="Total number of results")


class ApartmentDetail(BaseModel):
    """Individual apartment details within an address."""
    expedient: str = Field(..., description="Expedient number")
    registre_generalitat: Optional[str] = Field(None, description="Official registration number")
    num_places: Optional[int] = Field(None, description="Number of tourist places/beds")
    year: Optional[int] = Field(None, description="Year extracted from expedient")
    bloc: Optional[str] = Field(None, description="Building block")
    portal: Optional[str] = Field(None, description="Portal/entrance number")
    escala: Optional[str] = Field(None, description="Staircase identifier")
    pis: Optional[str] = Field(None, description="Floor number")
    porta: Optional[str] = Field(None, description="Door/unit number")
    
    class Config:
        from_attributes = True


class AddressGroup(BaseModel):
    """Address-grouped apartment resource model."""
    
    # Full computed address
    address: str = Field(..., description="Full formatted address")
    
    # Address fields
    tipus_carrer: Optional[str] = Field(None, description="Street type")
    carrer: Optional[str] = Field(None, description="Street name")
    tipus_num: Optional[int] = Field(None, description="Number type")
    num1: Optional[int] = Field(None, description="Primary street number")
    lletra1: Optional[str] = Field(None, description="Letter suffix for primary number")
    num2: Optional[int] = Field(None, description="Secondary street number")
    lletra2: Optional[str] = Field(None, description="Letter suffix for secondary number")
    
    # Location fields
    codi_districte: Optional[int] = Field(None, description="District code")
    nom_districte: Optional[str] = Field(None, description="District name")
    codi_barri: Optional[int] = Field(None, description="Neighborhood code")
    nom_barri: Optional[str] = Field(None, description="Neighborhood name")
    longitud_x: Optional[float] = Field(None, description="Geographic longitude (WGS84)")
    latitud_y: Optional[float] = Field(None, description="Geographic latitude (WGS84)")
    
    # Aggregated fields
    apartments_count: int = Field(..., description="Number of apartments at this address")
    total_places: int = Field(..., description="Total number of tourist places/beds at this address")
    apartments: List[ApartmentDetail] = Field(..., description="List of apartments at this address")
    
    class Config:
        from_attributes = True


class ApartmentMapResponse(BaseModel):
    """Response model for apartments/map endpoint."""
    data: List[AddressGroup] = Field(..., description="List of addresses with aggregated apartment data")
    meta: ApartmentMeta = Field(..., description="Response metadata")


class ApartmentSearchResponse(BaseModel):
    """Response model for apartments/search endpoint."""
    data: List[AddressGroup] = Field(..., description="List of addresses matching search criteria with aggregated data")
    meta: ApartmentMeta = Field(..., description="Response metadata")


class District(BaseModel):
    """District resource model with apartment count."""
    codi_districte: int = Field(..., description="District code")
    nom_districte: str = Field(..., description="District name")
    apartments: int = Field(..., description="Number of tourist apartments in this district")


class DistrictListResponse(BaseModel):
    """Response model for apartments/districts endpoint."""
    data: List[District] = Field(..., description="List of districts with apartment counts")
    meta: ApartmentMeta = Field(..., description="Response metadata")


class Neighborhood(BaseModel):
    """Neighborhood resource model with apartment count."""
    codi_barri: int = Field(..., description="Neighborhood code")
    nom_barri: str = Field(..., description="Neighborhood name")
    codi_districte: int = Field(..., description="District code this neighborhood belongs to")
    nom_districte: str = Field(..., description="District name this neighborhood belongs to")
    apartments: int = Field(..., description="Number of tourist apartments in this neighborhood")


class NeighborhoodListResponse(BaseModel):
    """Response model for apartments/neighborhoods endpoint."""
    data: List[Neighborhood] = Field(..., description="List of neighborhoods with apartment counts")
    meta: ApartmentMeta = Field(..., description="Response metadata")


# ============================================================================
# Helper Functions
# ============================================================================

def row_to_apartment(row: Any) -> Dict[str, Any]:
    """Convert a database row to an apartment dictionary."""
    return {
        "n_expedient": row.n_expedient,
        "codi_districte": row.codi_districte,
        "nom_districte": row.nom_districte,
        "codi_barri": row.codi_barri,
        "nom_barri": row.nom_barri,
        "tipus_carrer": row.tipus_carrer,
        "carrer": row.carrer,
        "tipus_num": row.tipus_num,
        "num1": row.num1,
        "lletra1": row.lletra1,
        "num2": row.num2,
        "lletra2": row.lletra2,
        "bloc": row.bloc,
        "portal": row.portal,
        "escala": row.escala,
        "pis": row.pis,
        "porta": row.porta,
        "numero_registre_generalitat": row.numero_registre_generalitat,
        "numero_places": row.numero_places,
        "longitud_x": float(row.longitud_x) if row.longitud_x is not None else None,
        "latitud_y": float(row.latitud_y) if row.latitud_y is not None else None,
        "year_updated": row.year_updated,
        "quarter_updated": row.quarter_updated,
        "dataset_id": row.dataset_id,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def row_to_address_group(row: Any) -> Dict[str, Any]:
    """Convert a database row to an address group dictionary."""
    return {
        "address": row.address,
        "tipus_carrer": row.tipus_carrer,
        "carrer": row.carrer,
        "tipus_num": row.tipus_num,
        "num1": row.num1,
        "lletra1": row.lletra1,
        "num2": row.num2,
        "lletra2": row.lletra2,
        "codi_districte": row.codi_districte,
        "nom_districte": row.nom_districte,
        "codi_barri": row.codi_barri,
        "nom_barri": row.nom_barri,
        "longitud_x": float(row.longitud_x) if row.longitud_x is not None else None,
        "latitud_y": float(row.latitud_y) if row.latitud_y is not None else None,
        "apartments_count": row.apartments_count,
        "total_places": row.total_places,
        "apartments": row.apartments if row.apartments else [],
    }


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/apartments/map", response_model=ApartmentMapResponse)
async def get_apartments_map(db: Session = Depends(get_db)):
    """
    Get all apartments grouped by address from barcelona.habitatges_us_turistic table.
    
    This endpoint returns all tourist apartments in Barcelona grouped by address.
    Each result represents a unique address with aggregate information about
    all apartments at that location. Useful for displaying addresses on a map.
    
    Returns:
        ApartmentMapResponse: All addresses with aggregated apartment data and metadata
    """
    query = text("""
        SELECT 
            -- Computed full address
            TRIM(
                COALESCE(tipus_carrer || ' ', '') ||
                COALESCE(carrer, '') || ' ' ||
                COALESCE(num1::text, '') ||
                COALESCE(lletra1, '') ||
                CASE WHEN num2 IS NOT NULL THEN '-' || num2::text ELSE '' END ||
                COALESCE(lletra2, '')
            ) as address,
            
            tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2,
            MIN(codi_districte) as codi_districte,
            MIN(nom_districte) as nom_districte,
            MIN(codi_barri) as codi_barri,
            MIN(nom_barri) as nom_barri,
            MIN(longitud_x) as longitud_x,
            MIN(latitud_y) as latitud_y,
            COUNT(*) as apartments_count,
            COALESCE(SUM(numero_places), 0) as total_places,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'expedient', n_expedient,
                        'registre_generalitat', numero_registre_generalitat,
                        'num_places', numero_places,
                        'year', CASE 
                            WHEN n_expedient ~ '^[0-9]{2}-[0-9]{4}-[0-9]+$' 
                            THEN CAST(SUBSTRING(n_expedient, 4, 4) AS INTEGER)
                            ELSE NULL
                        END,
                        'bloc', bloc,
                        'portal', portal,
                        'escala', escala,
                        'pis', pis,
                        'porta', porta
                    ) ORDER BY n_expedient
                ) FILTER (WHERE n_expedient IS NOT NULL),
                '[]'::json
            ) as apartments
        FROM barcelona.habitatges_us_turistic
        GROUP BY tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
        ORDER BY MIN(codi_districte), MIN(codi_barri), carrer, num1
    """)
    
    result = db.execute(query)
    rows = result.fetchall()
    
    addresses = [row_to_address_group(row) for row in rows]
    
    return {
        "data": addresses,
        "meta": {"total": len(addresses)}
    }


@router.get("/apartments/search", response_model=ApartmentSearchResponse)
async def search_apartments(
    tipus_carrer: Optional[str] = Query(None, description="Street type (e.g., Carrer, Plaça)"),
    carrer: Optional[str] = Query(None, description="Street name"),
    num1: Optional[int] = Query(None, description="Primary street number"),
    codi_districte: Optional[int] = Query(None, description="District code"),
    nom_districte: Optional[str] = Query(None, description="District name (partial match)"),
    codi_barri: Optional[int] = Query(None, description="Neighborhood code"),
    nom_barri: Optional[str] = Query(None, description="Neighborhood name (partial match)"),
    numero_registre_generalitat: Optional[str] = Query(None, description="Official registration number"),
    db: Session = Depends(get_db)
):
    """
    Search apartments by address or other criteria, grouped by address.
    
    This endpoint allows filtering apartments by various fields including address
    components (street type, street name, number) and location (district, neighborhood).
    Results are grouped by address, showing aggregate information for each unique address.
    All filters are optional and can be combined.
    
    Args:
        tipus_carrer: Filter by street type (exact match)
        carrer: Filter by street name (partial match, case-insensitive)
        num1: Filter by primary street number (exact match)
        codi_districte: Filter by district code (exact match)
        nom_districte: Filter by district name (partial match, case-insensitive)
        codi_barri: Filter by neighborhood code (exact match)
        nom_barri: Filter by neighborhood name (partial match, case-insensitive)
        numero_registre_generalitat: Filter by registration number (exact match)
        
    Returns:
        ApartmentSearchResponse: Matching addresses with aggregated apartment data and metadata
    """
    # Build dynamic WHERE clause
    where_clauses = []
    params = {}
    
    if tipus_carrer:
        where_clauses.append("tipus_carrer = :tipus_carrer")
        params["tipus_carrer"] = tipus_carrer
    
    if carrer:
        where_clauses.append("LOWER(carrer) LIKE LOWER(:carrer)")
        params["carrer"] = f"%{carrer}%"
    
    if num1 is not None:
        where_clauses.append("num1 = :num1")
        params["num1"] = num1
    
    if codi_districte is not None:
        where_clauses.append("codi_districte = :codi_districte")
        params["codi_districte"] = codi_districte
    
    if nom_districte:
        where_clauses.append("LOWER(nom_districte) LIKE LOWER(:nom_districte)")
        params["nom_districte"] = f"%{nom_districte}%"
    
    if codi_barri is not None:
        where_clauses.append("codi_barri = :codi_barri")
        params["codi_barri"] = codi_barri
    
    if nom_barri:
        where_clauses.append("LOWER(nom_barri) LIKE LOWER(:nom_barri)")
        params["nom_barri"] = f"%{nom_barri}%"
    
    if numero_registre_generalitat:
        where_clauses.append("numero_registre_generalitat = :numero_registre_generalitat")
        params["numero_registre_generalitat"] = numero_registre_generalitat
    
    # Build final query with grouping
    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    
    query = text(f"""
        SELECT 
            -- Computed full address
            TRIM(
                COALESCE(tipus_carrer || ' ', '') ||
                COALESCE(carrer, '') || ' ' ||
                COALESCE(num1::text, '') ||
                COALESCE(lletra1, '') ||
                CASE WHEN num2 IS NOT NULL THEN '-' || num2::text ELSE '' END ||
                COALESCE(lletra2, '')
            ) as address,
            
            tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2,
            MIN(codi_districte) as codi_districte,
            MIN(nom_districte) as nom_districte,
            MIN(codi_barri) as codi_barri,
            MIN(nom_barri) as nom_barri,
            MIN(longitud_x) as longitud_x,
            MIN(latitud_y) as latitud_y,
            COUNT(*) as apartments_count,
            COALESCE(SUM(numero_places), 0) as total_places,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'expedient', n_expedient,
                        'registre_generalitat', numero_registre_generalitat,
                        'num_places', numero_places,
                        'year', CASE 
                            WHEN n_expedient ~ '^[0-9]{{2}}-[0-9]{{4}}-[0-9]+$' 
                            THEN CAST(SUBSTRING(n_expedient, 4, 4) AS INTEGER)
                            ELSE NULL
                        END,
                        'bloc', bloc,
                        'portal', portal,
                        'escala', escala,
                        'pis', pis,
                        'porta', porta
                    ) ORDER BY n_expedient
                ) FILTER (WHERE n_expedient IS NOT NULL),
                '[]'::json
            ) as apartments
        FROM barcelona.habitatges_us_turistic
        WHERE {where_sql}
        GROUP BY tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
        ORDER BY MIN(codi_districte), MIN(codi_barri), carrer, num1
    """)
    
    result = db.execute(query, params)
    rows = result.fetchall()
    
    addresses = [row_to_address_group(row) for row in rows]
    
    return {
        "data": addresses,
        "meta": {"total": len(addresses)}
    }


@router.get("/apartments/districts", response_model=DistrictListResponse)
async def get_districts(db: Session = Depends(get_db)):
    """
    Get list of all districts with apartment counts.
    
    Returns a summary of all districts in Barcelona with the number of tourist
    apartments in each district. Useful for building district filters or showing
    district-level statistics.
    
    Returns:
        DistrictListResponse: All districts with apartment counts and metadata
    """
    query = text("""
        SELECT DISTINCT 
            hut.codi_districte, 
            MIN(hut.nom_districte) as nom_districte, 
            COUNT(*) as apartments
        FROM barcelona.habitatges_us_turistic hut 
        WHERE hut.codi_barri IS NOT NULL
        GROUP BY hut.codi_districte
        ORDER BY hut.codi_districte
    """)
    
    result = db.execute(query)
    rows = result.fetchall()
    
    districts = [
        {
            "codi_districte": row.codi_districte,
            "nom_districte": row.nom_districte,
            "apartments": row.apartments
        }
        for row in rows
    ]
    
    return {
        "data": districts,
        "meta": {"total": len(districts)}
    }


@router.get("/apartments/neighborhoods", response_model=NeighborhoodListResponse)
async def get_neighborhoods(db: Session = Depends(get_db)):
    """
    Get list of all neighborhoods with apartment counts.
    
    Returns a summary of all neighborhoods (barris) in Barcelona with the number
    of tourist apartments in each neighborhood and their parent district code.
    Useful for building neighborhood filters or showing neighborhood-level statistics.
    
    Returns:
        NeighborhoodListResponse: All neighborhoods with apartment counts and metadata
    """
    query = text("""
        SELECT 
            hut.codi_barri, 
            MIN(hut.nom_barri) as nom_barri, 
            MAX(hut.codi_districte) as codi_districte,
            MIN(hut.nom_districte) as nom_districte,
            COUNT(*) as apartments
        FROM barcelona.habitatges_us_turistic hut 
        WHERE hut.codi_barri IS NOT NULL
        GROUP BY hut.codi_barri
        ORDER BY codi_districte, hut.codi_barri
    """)
    
    result = db.execute(query)
    rows = result.fetchall()
    
    neighborhoods = [
        {
            "codi_barri": row.codi_barri,
            "nom_barri": row.nom_barri,
            "codi_districte": row.codi_districte,
            "nom_districte": row.nom_districte,
            "apartments": row.apartments
        }
        for row in rows
    ]
    
    return {
        "data": neighborhoods,
        "meta": {"total": len(neighborhoods)}
    }


