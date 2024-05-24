WITH pair AS (
    SELECT DISTINCT
        args ->> 'pool' AS id,
        'hydradx' AS dexKey,
        CAST(args ->> 'assetA' AS numeric) AS asset0Id,
        CAST(args ->> 'assetB' AS numeric) AS asset1Id,
        30 AS feeBps
    FROM
        event
    WHERE
        name = 'XYK.PoolCreated'
)
SELECT
    id,
    dexKey,
    CASE 
        WHEN asset0Id < asset1Id THEN asset0Id 
        ELSE asset1Id 
    END AS asset0Id,
    CASE 
        WHEN asset0Id < asset1Id THEN asset1Id 
        ELSE asset0Id 
    END AS asset1Id,
    feeBps
FROM pair
WHERE
    CASE
        WHEN :pair IS NOT NULL
        THEN id = :pair
        ELSE true
    END