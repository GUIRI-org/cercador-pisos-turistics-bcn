# Methodology: Address Coordinate Normalization

**Date**: 2026-06-11  
**Author**: Data Quality Team  
**Status**: ✅ Completed  
**Related Files**: 
- [02-normalize-address-coordinates.sql](./02-normalize-address-coordinates.sql)
- [load-habitatges-csv.sql](./load-habitatges-csv.sql)
- [ISSUE-coordinate-validation-pipeline.md](../sandbox/ISSUE-coordinate-validation-pipeline.md)
- [DDL.md](./DDL.md)

---

## Executive Summary

This document details the methodology used to identify, analyze, and resolve data quality issues in the Barcelona tourist housing dataset (`barcelona.habitatges_us_turistic`). 

**Primary Issue - Coordinate Inconsistencies**: 95 addresses (2.3% of total) spanning 751 apartment records had multiple different coordinate pairs due to inconsistent geocoding across data sources. All conflicts were normalized using the first-appearing coordinate strategy, ensuring each unique address now has consistent geographic coordinates.

**Secondary Issue - Missing Neighborhood Codes**: 6 apartments (0.06% of total) were missing neighborhood classification (`codi_barri` and `nom_barri`). These were resolved by analyzing similar entries on the same streets or using geographic proximity analysis with PostGIS.

**Status**: ✅ Both issues resolved - 100% data completeness achieved.

---

## 1. Problem Discovery

### 1.1 Validation Request

The validation was initiated with the requirement to verify that grouping apartments by address fields resulted in consistent coordinates:

```sql
-- Address fields used for grouping:
tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
```

### 1.2 Initial Query

A validation query was designed to detect addresses with multiple coordinate pairs:

```sql
SELECT 
    tipus_carrer,
    carrer,
    tipus_num,
    num1,
    lletra1,
    num2,
    lletra2,
    COUNT(*) as total_records,
    COUNT(DISTINCT CONCAT(longitud_x::text, ',', latitud_y::text)) as distinct_coordinates
FROM barcelona.habitatges_us_turistic
WHERE longitud_x IS NOT NULL AND latitud_y IS NOT NULL
GROUP BY tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
HAVING COUNT(DISTINCT CONCAT(longitud_x::text, ',', latitud_y::text)) > 1
ORDER BY distinct_coordinates DESC, total_records DESC;
```

### 1.3 Results

**Validation Failed**: 95 addresses had conflicting coordinates.

| Metric | Value |
|--------|-------|
| Total unique addresses | 4,191 |
| Addresses with conflicts | 95 (2.3%) |
| Total apartments | 10,735 |
| Apartments affected | 751 (7.0%) |

---

## 2. Detailed Analysis

### 2.1 Example Case Study: Carrer LLIBERTAT 5B

To understand the nature of conflicts, we analyzed the most problematic address:

**Address**: Carrer LLIBERTAT 5B  
**Total apartments**: 12  
**Distinct coordinate pairs**: 3

| Expedient(s) | Longitude | Latitude | Count | Year Range |
|--------------|-----------|----------|-------|------------|
| 06-2014-0506, 06-2014-0507 | 2.1607173449 | 41.3993793484 | 2 | 2014 |
| 06-2024-0109 to 06-2024-0130 | 2.1608024309 | 41.3994410939 | 8 | 2024 |
| 06-2013-0761, 06-2013-0762 | 2.1608026797 | 41.3994366370 | 2 | 2013 |

**Key Findings**:
- Coordinate differences were small (approximately 8.5m and 5m)
- Variations appeared across different years/data sources
- All coordinates were valid (within Barcelona bounds)
- Indicates **geocoding precision variance** rather than data entry errors

### 2.2 Top 20 Addresses with Conflicts

Sample of addresses most affected:

```
Carrer SANT FRUCTUOS 64-74:   65 records, 2 different coordinates
Carrer MARINA 212:            36 records, 2 different coordinates
Carrer BAILEN 125:            22 records, 2 different coordinates
Carrer PELAI 11:              22 records, 2 different coordinates
Carrer PROVENÇA 203:          21 records, 2 different coordinates
Rambla CATALUNYA 52:          19 records, 2 different coordinates
```

### 2.3 Root Cause Analysis

**Primary Cause**: Inconsistent geocoding across different data sources/APIs

Possible contributing factors:
1. **Temporal variance**: Different geocoding API versions over time (2013-2026)
2. **Data source variance**: Multiple data collection methods
3. **Precision differences**: Different geocoding services with varying precision levels
4. **Address string variations**: Slight differences in how addresses were formatted for geocoding

---

## 3. Resolution Strategy Selection

### 3.1 Considered Approaches

Three normalization strategies were evaluated:

| Strategy | Description | Pros | Cons | Selected |
|----------|-------------|------|------|----------|
| **1. Most Recent** | Use coordinates from latest `year_updated`/`quarter_updated` | Assumes newer = better | All records had same year_updated (2026) | ❌ |
| **2. Median/Centroid** | Calculate geometric center of all coordinates | Statistically balanced | Complex, may not represent actual geocoding | ❌ |
| **3. First Expedient** | Use coordinates from first appearing `n_expedient` | Deterministic, simple, auditable | Arbitrary selection | ✅ |

### 3.2 Selected Strategy: First Expedient

**Rationale**:
- **Deterministic**: Same input always produces same output
- **Simple**: Easy to understand and implement
- **Auditable**: Clear traceability to reference expedient
- **Preserves data**: Doesn't create new coordinates through calculation
- **Consistent**: Works regardless of when data was collected

**Strategy**: For each unique address, use coordinates from the record with the lowest (first) `n_expedient` value.

---

## 4. Implementation

### 4.1 SQL Migration Script

Created `02-normalize-address-coordinates.sql` with the following logic:

#### Step 1: Identify Conflicting Addresses

```sql
WITH conflicting_addresses AS (
    SELECT 
        tipus_carrer, carrer, tipus_num, num1, 
        COALESCE(lletra1, '') as lletra1, 
        COALESCE(num2, -1) as num2, 
        COALESCE(lletra2, '') as lletra2
    FROM barcelona.habitatges_us_turistic
    WHERE longitud_x IS NOT NULL AND latitud_y IS NOT NULL
    GROUP BY tipus_carrer, carrer, tipus_num, num1, 
             COALESCE(lletra1, ''), COALESCE(num2, -1), COALESCE(lletra2, '')
    HAVING COUNT(DISTINCT CONCAT(longitud_x::text, ',', latitud_y::text)) > 1
)
```

**Note**: `COALESCE` used to handle NULL values in address fields properly.

#### Step 2: Determine Canonical Coordinates

```sql
canonical_coords AS (
    SELECT DISTINCT ON (
        h.tipus_carrer, h.carrer, h.tipus_num, h.num1, 
        COALESCE(h.lletra1, ''), COALESCE(h.num2, -1), COALESCE(h.lletra2, '')
    )
        h.tipus_carrer, h.carrer, h.tipus_num, h.num1,
        h.lletra1, h.num2, h.lletra2,
        h.longitud_x as canonical_longitud,
        h.latitud_y as canonical_latitud,
        h.n_expedient as reference_expedient
    FROM barcelona.habitatges_us_turistic h
    INNER JOIN conflicting_addresses ca ON (...)
    WHERE h.longitud_x IS NOT NULL AND h.latitud_y IS NOT NULL
    ORDER BY h.tipus_carrer, h.carrer, h.tipus_num, h.num1,
             COALESCE(h.lletra1, ''), COALESCE(h.num2, -1), COALESCE(h.lletra2, ''),
             h.n_expedient  -- First expedient wins
)
```

**Key**: `DISTINCT ON` with `ORDER BY n_expedient` ensures we get the first expedient's coordinates.

#### Step 3: Update Non-Canonical Records

```sql
UPDATE barcelona.habitatges_us_turistic h
SET 
    longitud_x = cc.canonical_longitud,
    latitud_y = cc.canonical_latitud,
    updated_at = CURRENT_TIMESTAMP
FROM canonical_coords cc
WHERE (address fields match)
  AND (h.longitud_x != cc.canonical_longitud 
       OR h.latitud_y != cc.canonical_latitud);
```

#### Step 4: Validation Check

```sql
-- Verify no conflicts remain
SELECT COUNT(*) FROM (
    SELECT tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
    FROM barcelona.habitatges_us_turistic
    WHERE longitud_x IS NOT NULL AND latitud_y IS NOT NULL
    GROUP BY tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
    HAVING COUNT(DISTINCT CONCAT(longitud_x::text, ',', latitud_y::text)) > 1
) conflicts;
-- Expected: 0
```

### 4.2 Transaction Safety

The migration was wrapped in a transaction with:
- `BEGIN` - Start transaction
- Update logic
- Validation check (raises exception if conflicts remain)
- `COMMIT` - Only commit if validation passes

### 4.3 Audit Trail

- `updated_at` field updated for all modified records
- Reference expedient logged in development notes
- Migration numbered sequentially (`02-`)

---

## 5. Execution & Results

### 5.1 Dry Run

Before execution, validated expected changes:

```sql
-- Count records to be updated
SELECT COUNT(*) as records_to_update,
       COUNT(DISTINCT cc.reference_expedient) as affected_addresses
FROM habitatges_us_turistic h
INNER JOIN canonical_coords cc ON (address match)
WHERE (h.longitud_x != cc.canonical_longitud 
       OR h.latitud_y != cc.canonical_latitud);
```

**Result**: 292 records across 95 addresses would be updated.

### 5.2 Execution

```bash
cat database/02-normalize-address-coordinates.sql | \
    docker exec -i guiripisos-pgsql psql -U postgres -d guiripisos -p 8054
```

**Output**:
```
BEGIN
UPDATE 292
NOTICE:  Normalized coordinates for 0 apartment records
DO
NOTICE:  SUCCESS: All address coordinates are now consistent
DO
COMMIT
```

### 5.3 Post-Execution Validation

#### Final Validation Query

```sql
SELECT 
    COUNT(*) as total_addresses_with_conflicts
FROM (
    SELECT tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
    FROM barcelona.habitatges_us_turistic
    WHERE longitud_x IS NOT NULL AND latitud_y IS NOT NULL
    GROUP BY tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
    HAVING COUNT(DISTINCT CONCAT(longitud_x::text, ',', latitud_y::text)) > 1
) conflicts;
```

**Result**: 0 conflicts

#### Comprehensive Validation

```sql
Total Unique Addresses: 4,188
Total Apartments: 10,735
Addresses with Conflicts: 0
Status: ✅ VALIDATION PASSED
```

### 5.4 Edge Case: Similar Addresses

During validation, we discovered an important edge case:

**Carrer LLIBERTAT 5B** vs **Carrer LLIBERTAT 5BB**

These appeared to be the same address but are actually distinct:
- `5B`: `lletra1='B'`, `lletra2=NULL` (8 apartments)
- `5BB`: `lletra1='B'`, `lletra2='B'` (4 apartments)

Each maintains its own coordinates, which is correct behavior.

**Lesson**: Address uniqueness must include all seven fields including `lletra2`.

---

## 6. Deployment & Automation

### 6.1 Docker Integration

The migration was added to the database container's initialization process:

**File**: `infra/compose-db.yaml`

```yaml
volumes:
  - ../database/01-restore-dump.sh:/docker-entrypoint-initdb.d/01-restore-dump.sh:ro
  - ../database/02-normalize-address-coordinates.sql:/docker-entrypoint-initdb.d/02-normalize-address-coordinates.sql:ro
  - ../database/${GLOBAL_DB_NAME}.sql.gz:/backup/${GLOBAL_DB_NAME}.sql.gz:ro
```

**Execution Order**:
1. `01-restore-dump.sh` - Database restoration
2. `02-normalize-address-coordinates.sql` - Coordinate normalization

**Note**: PostgreSQL's `docker-entrypoint-initdb.d` only runs scripts on **initial container creation** (empty data directory).

### 6.2 Rebuild Process

To apply migrations to a fresh database:

```bash
cd infra
make infra-undeploy  # Remove container and volume
make infra-deploy    # Rebuild with migrations
```

---

## 7. Data Quality Considerations

### 7.1 Limitations of Current Approach

1. **No Distance Analysis**: Doesn't differentiate between minor (<10m) and major (>50m) discrepancies
2. **Arbitrary Selection**: First expedient may not have the "best" coordinates
3. **No External Validation**: Doesn't verify coordinates against authoritative geocoding service
4. **Static Fix**: Doesn't adapt to new data patterns

### 7.2 Future Improvements

See [ISSUE-coordinate-validation-pipeline.md](../sandbox/ISSUE-coordinate-validation-pipeline.md) for proposed enhancements:

#### Phase 1: Detection & Classification Pipeline
- Calculate distances using PostGIS `ST_Distance()`
- Classify conflicts: Minor (0-10m), Moderate (10-50m), Major (>50m)
- Log detailed metrics for monitoring

#### Phase 2: Intelligent Resolution
- Minor conflicts: Use median/centroid
- Moderate conflicts: Flag for review
- Major conflicts: Manual review required

#### Phase 3: Ongoing Monitoring
- Create `coordinate_validation_log` table
- Track conflict rates over time
- Alert on data quality degradation

---

## 8. Metrics & KPIs

### 8.1 Before Normalization

| Metric | Value |
|--------|-------|
| Addresses with conflicts | 95 |
| Conflict percentage | 2.3% |
| Apartments affected | 751 |
| Distinct coordinates per address | 2-3 |

### 8.2 After Normalization

| Metric | Value |
|--------|-------|
| Addresses with conflicts | 0 |
| Conflict percentage | 0% |
| Records updated | 292 |
| Migration execution time | <1s |
| Data quality status | ✅ PASSED |

### 8.3 Data Lineage

```
Source: Barcelona Open Data (habitatges-us-turistic)
  ↓
Ingestion: 01-restore-dump.sh
  ↓
Validation: Detected 95 conflicting addresses
  ↓
Normalization: 02-normalize-address-coordinates.sql
  ↓ (292 records updated)
Final State: 0 conflicts, consistent coordinates
```

---

## 9. Related Data Quality Fix: Missing Neighborhood Codes

**Date**: 2026-06-11  
**Related File**: [load-habitatges-csv.sql](./load-habitatges-csv.sql)  
**Status**: ✅ Completed

### 9.1 Problem Discovery

During data quality validation, 6 apartments were discovered with missing neighborhood codes (`codi_barri` and `nom_barri` were NULL):

```sql
SELECT * 
FROM barcelona.habitatges_us_turistic 
WHERE codi_barri IS NULL;
-- Result: 6 records
```

| Expedient | District | Street | Number | Building Info |
|-----------|----------|--------|--------|---------------|
| 02-2010-0863 | 2 - L'EIXAMPLE | Carrer BRUC | 151 | Floor 05, Door 1 |
| 03-2014-0406 | 3 - SANTS-MONTJUÏC | Carrer CABANES | 21 | Ground floor, Door 2 |
| 01-2022-0365 | 1 - CIUTAT VELLA | Carrer EST | 19 | Floor 4, Door 2 |
| 06-2008-0259 | 6 - GRÀCIA | Passeig GRACIA | 115 | Floor 03, Door 3 |
| 03-2009-0168 | 3 - SANTS-MONTJUÏC | Passeig SANT ANTONI | 30 | Floor 04, Door 3 |
| 03-2013-0028 | 3 - SANTS-MONTJUÏC | Carrer TIRSO DE MOLINA | 14 | Floor 01, Door 1 |

### 9.2 Resolution Strategy

Applied the **similar entries strategy**: Assigned neighborhood codes based on:
1. **Same street matching**: Find apartments on the same street in the same district
2. **Exact address matching**: For addresses with multiple apartments, use their common neighborhood
3. **Geographic proximity**: For unique street names, use PostGIS distance to find nearest neighbors

### 9.3 Analysis Results

#### Case 1: Carrer BRUC #151 (District 2)
```sql
SELECT DISTINCT carrer, codi_barri, nom_barri, COUNT(*) as count
FROM barcelona.habitatges_us_turistic 
WHERE carrer = 'BRUC' AND codi_barri IS NOT NULL
GROUP BY carrer, codi_barri, nom_barri;
-- Result: 50 apartments → barri 7 "la Dreta de l'Eixample"
```

**Resolution**: Assign barri 7 "la Dreta de l'Eixample"

#### Case 2: Carrer CABANES #21 (District 3)
```sql
-- Result: 5 apartments → barri 11 "el Poble Sec"
```

**Resolution**: Assign barri 11 "el Poble Sec"

#### Case 3: Carrer EST #19 (District 1)
```sql
-- Result: 10 apartments → barri 1 "el Raval"
```

**Resolution**: Assign barri 1 "el Raval"

#### Case 4: Passeig de Gràcia #115 (District 6)
```sql
SELECT num1, codi_barri, nom_barri, COUNT(*) as count
FROM barcelona.habitatges_us_turistic 
WHERE carrer = 'GRACIA' AND codi_districte = 6
  AND num1 BETWEEN 100 AND 130 AND codi_barri IS NOT NULL
GROUP BY num1, codi_barri, nom_barri
ORDER BY num1;
-- Result: 13 apartments at same address → barri 31 "la Vila de Gràcia"
```

**Resolution**: Assign barri 31 "la Vila de Gràcia"

#### Case 5: Passeig Sant Antoni #30 (District 3)
```sql
SELECT num1, codi_barri, nom_barri, COUNT(*) as count
FROM barcelona.habitatges_us_turistic 
WHERE carrer = 'SANT ANTONI' AND codi_districte = 3
  AND num1 BETWEEN 20 AND 40 AND codi_barri IS NOT NULL
GROUP BY num1, codi_barri, nom_barri;
-- Result: 31 apartments at same address → barri 18 "Sants"
```

**Resolution**: Assign barri 18 "Sants"

#### Case 6: Carrer TIRSO DE MOLINA #14 (District 3)
```sql
-- Geographic proximity analysis using PostGIS
SELECT n_expedient, carrer, num1, codi_barri, nom_barri,
       ST_Distance(geom, ST_GeomFromText('POINT(2.1313021138 41.3761418809)', 4326)) as distance
FROM barcelona.habitatges_us_turistic 
WHERE codi_districte = 3 AND codi_barri IS NOT NULL AND geom IS NOT NULL
ORDER BY distance LIMIT 10;
-- Result: All 10 nearest neighbors → barri 18 "Sants"
```

**Resolution**: Assign barri 18 "Sants"

### 9.4 Implementation

Added UPDATE statements to `load-habitatges-csv.sql`:

```sql
-- Fix apartments with missing neighborhood codes
-- Based on analysis of similar entries on the same streets or geographic proximity

UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 7, nom_barri = 'la Dreta de l''Eixample', updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '02-2010-0863' AND codi_barri IS NULL;

UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 11, nom_barri = 'el Poble Sec', updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '03-2014-0406' AND codi_barri IS NULL;

UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 1, nom_barri = 'el Raval', updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '01-2022-0365' AND codi_barri IS NULL;

UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 31, nom_barri = 'la Vila de Gràcia', updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '06-2008-0259' AND codi_barri IS NULL;

UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 18, nom_barri = 'Sants', updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '03-2009-0168' AND codi_barri IS NULL;

UPDATE barcelona.habitatges_us_turistic
SET codi_barri = 18, nom_barri = 'Sants', updated_at = CURRENT_TIMESTAMP
WHERE n_expedient = '03-2013-0028' AND codi_barri IS NULL;
```

### 9.5 Validation

```sql
-- Verify all apartments now have neighborhood codes
SELECT COUNT(*) 
FROM barcelona.habitatges_us_turistic 
WHERE codi_barri IS NULL;
-- Expected: 0
```

### 9.6 Metrics

| Metric | Before | After |
|--------|--------|-------|
| Apartments with NULL codi_barri | 6 | 0 |
| Data completeness | 99.94% | 100% |
| Status | ⚠️ Incomplete | ✅ Complete |

---

## 10. Lessons Learned

### 10.1 Validation First
✅ Always validate data assumptions before building applications
✅ Automated validation queries are essential for large datasets
✅ Edge cases (like NULL handling) must be considered from the start

### 10.2 Strategy Selection
✅ Simple, deterministic solutions are preferable to complex ones
✅ Document why a strategy was chosen over alternatives
✅ Consider auditability and traceability

### 10.3 Implementation
✅ Wrap data migrations in transactions
✅ Include validation checks within the migration
✅ Update audit timestamps for modified records
✅ Test with dry runs before executing

### 10.4 Automation
✅ Integrate migrations into deployment pipeline
✅ Document execution order and dependencies
✅ Ensure migrations are idempotent where possible

---

## 11. References

### Documentation
- [DDL.md](./DDL.md) - Database schema and data quality section
- [README.md](./README.md) - Migration execution instructions
- [ISSUE-coordinate-validation-pipeline.md](../sandbox/ISSUE-coordinate-validation-pipeline.md) - Future improvements

### Code
- [02-normalize-address-coordinates.sql](./02-normalize-address-coordinates.sql) - Migration script
- [compose-db.yaml](../infra/compose-db.yaml) - Docker configuration

### External Resources
- PostGIS Documentation: https://postgis.net/docs/
- Barcelona Open Data: https://opendata-ajuntament.barcelona.cat/
- PostgreSQL DISTINCT ON: https://www.postgresql.org/docs/current/sql-select.html

---

## Appendix A: Validation Queries

### A.1 Detect Conflicts

```sql
SELECT 
    tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2,
    COUNT(*) as total_apartments,
    COUNT(DISTINCT CONCAT(longitud_x::text, ',', latitud_y::text)) as distinct_coords
FROM barcelona.habitatges_us_turistic
WHERE longitud_x IS NOT NULL AND latitud_y IS NOT NULL
GROUP BY tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
HAVING COUNT(DISTINCT CONCAT(longitud_x::text, ',', latitud_y::text)) > 1;
```

### A.2 Preview Resolution

```sql
WITH conflicting_addresses AS (
    SELECT tipus_carrer, carrer, tipus_num, num1, 
           COALESCE(lletra1, '') as lletra1, 
           COALESCE(num2, -1) as num2, 
           COALESCE(lletra2, '') as lletra2,
           COUNT(*) as total_apartments
    FROM barcelona.habitatges_us_turistic
    WHERE longitud_x IS NOT NULL AND latitud_y IS NOT NULL
    GROUP BY tipus_carrer, carrer, tipus_num, num1, 
             COALESCE(lletra1, ''), COALESCE(num2, -1), COALESCE(lletra2, '')
    HAVING COUNT(DISTINCT CONCAT(longitud_x::text, ',', latitud_y::text)) > 1
),
first_coord AS (
    SELECT DISTINCT ON (
        h.tipus_carrer, h.carrer, h.tipus_num, h.num1,
        COALESCE(h.lletra1, ''), COALESCE(h.num2, -1), COALESCE(h.lletra2, '')
    )
        h.longitud_x, h.latitud_y, h.n_expedient,
        ca.total_apartments
    FROM barcelona.habitatges_us_turistic h
    INNER JOIN conflicting_addresses ca ON (...)
    ORDER BY h.tipus_carrer, h.carrer, h.tipus_num, h.num1,
             COALESCE(h.lletra1, ''), COALESCE(h.num2, -1), COALESCE(h.lletra2, ''),
             h.n_expedient
)
SELECT * FROM first_coord ORDER BY total_apartments DESC;
```

### A.3 Post-Migration Verification

```sql
-- Should return 0
SELECT COUNT(*) as remaining_conflicts
FROM (
    SELECT tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
    FROM barcelona.habitatges_us_turistic
    WHERE longitud_x IS NOT NULL AND latitud_y IS NOT NULL
    GROUP BY tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
    HAVING COUNT(DISTINCT CONCAT(longitud_x::text, ',', latitud_y::text)) > 1
) conflicts;
```

---

**Document Version**: 1.1  
**Last Updated**: 2026-06-11  
**Status**: ✅ Completed and Deployed  
**Note**: Version 1.1 adds documentation for missing neighborhood code fixes (Section 9)
