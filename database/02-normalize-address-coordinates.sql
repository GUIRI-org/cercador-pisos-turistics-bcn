-- Normalize coordinates for addresses with conflicting values
-- Strategy: Use the coordinates from the first expedient (alphabetically) for each address
-- This ensures consistency: same address = same coordinates

BEGIN;

-- Create a temporary table with canonical coordinates for conflicting addresses
WITH conflicting_addresses AS (
    SELECT 
        tipus_carrer, 
        carrer, 
        tipus_num, 
        num1, 
        COALESCE(lletra1, '') as lletra1, 
        COALESCE(num2, -1) as num2, 
        COALESCE(lletra2, '') as lletra2
    FROM barcelona.habitatges_us_turistic
    WHERE longitud_x IS NOT NULL AND latitud_y IS NOT NULL
    GROUP BY tipus_carrer, carrer, tipus_num, num1, COALESCE(lletra1, ''), COALESCE(num2, -1), COALESCE(lletra2, '')
    HAVING COUNT(DISTINCT CONCAT(longitud_x::text, ',', latitud_y::text)) > 1
),
canonical_coords AS (
    SELECT DISTINCT ON (
        h.tipus_carrer, 
        h.carrer, 
        h.tipus_num, 
        h.num1, 
        COALESCE(h.lletra1, ''), 
        COALESCE(h.num2, -1), 
        COALESCE(h.lletra2, '')
    )
        h.tipus_carrer,
        h.carrer,
        h.tipus_num,
        h.num1,
        h.lletra1,
        h.num2,
        h.lletra2,
        h.longitud_x as canonical_longitud,
        h.latitud_y as canonical_latitud,
        h.n_expedient as reference_expedient
    FROM barcelona.habitatges_us_turistic h
    INNER JOIN conflicting_addresses ca ON 
        h.tipus_carrer = ca.tipus_carrer AND 
        h.carrer = ca.carrer AND 
        h.tipus_num = ca.tipus_num AND 
        h.num1 = ca.num1 AND
        COALESCE(h.lletra1, '') = ca.lletra1 AND
        COALESCE(h.num2, -1) = ca.num2 AND
        COALESCE(h.lletra2, '') = ca.lletra2
    WHERE h.longitud_x IS NOT NULL AND h.latitud_y IS NOT NULL
    ORDER BY 
        h.tipus_carrer, 
        h.carrer, 
        h.tipus_num, 
        h.num1, 
        COALESCE(h.lletra1, ''), 
        COALESCE(h.num2, -1), 
        COALESCE(h.lletra2, ''), 
        h.n_expedient
)
-- Update records with non-canonical coordinates
UPDATE barcelona.habitatges_us_turistic h
SET 
    longitud_x = cc.canonical_longitud,
    latitud_y = cc.canonical_latitud,
    updated_at = CURRENT_TIMESTAMP
FROM canonical_coords cc
WHERE 
    h.tipus_carrer = cc.tipus_carrer AND 
    h.carrer = cc.carrer AND 
    h.tipus_num = cc.tipus_num AND 
    h.num1 = cc.num1 AND
    COALESCE(h.lletra1, '') = COALESCE(cc.lletra1, '') AND
    COALESCE(h.num2, -1) = COALESCE(cc.num2, -1) AND
    COALESCE(h.lletra2, '') = COALESCE(cc.lletra2, '')
    AND (h.longitud_x != cc.canonical_longitud OR h.latitud_y != cc.canonical_latitud);

-- Report results
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Normalized coordinates for % apartment records', updated_count;
END $$;

-- Verify: Check if there are still any conflicting addresses
DO $$
DECLARE
    remaining_conflicts INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_conflicts
    FROM (
        SELECT 
            tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
        FROM barcelona.habitatges_us_turistic
        WHERE longitud_x IS NOT NULL AND latitud_y IS NOT NULL
        GROUP BY tipus_carrer, carrer, tipus_num, num1, lletra1, num2, lletra2
        HAVING COUNT(DISTINCT CONCAT(longitud_x::text, ',', latitud_y::text)) > 1
    ) conflicts;
    
    IF remaining_conflicts > 0 THEN
        RAISE EXCEPTION 'Still have % addresses with conflicting coordinates!', remaining_conflicts;
    ELSE
        RAISE NOTICE 'SUCCESS: All address coordinates are now consistent';
    END IF;
END $$;

COMMIT;
