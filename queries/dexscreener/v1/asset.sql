-- dexscreenerAsset

/*
  Returns all tradable asset(s)
*/

SELECT
    id, 
    name, 
    symbol,
    (total_supply / 10^decimals)::numeric as total_supply
FROM
    token_metadata_dexscreener
WHERE
    CASE
        WHEN :asset::integer IS NOT NULL
        THEN id = :asset
        ELSE true
    END
ORDER BY 
    id;