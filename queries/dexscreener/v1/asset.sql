-- dexscreenerAsset

/*
  Returns all tradable asset(s)
*/

SELECT
    id, 
    name, 
    symbol
FROM
    token_metadata_test
WHERE
    CASE
        WHEN :asset::integer IS NOT NULL
        THEN id = :asset
        ELSE true
    END
ORDER BY 
    id;