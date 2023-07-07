-- getPairs
WITH listed AS (
    SELECT DISTINCT
        asset_id
    FROM
        omnipool_asset
),
combos AS (
    SELECT
        tm.symbol AS asset_1_symbol,
        tme.symbol AS asset_2_symbol
    FROM
        listed la
        CROSS JOIN listed lb
        JOIN token_metadata tm ON la.asset_id = tm.id
        JOIN token_metadata tme ON lb.asset_id = tme.id
)
SELECT DISTINCT
    CONCAT(LEAST(asset_1_symbol, asset_2_symbol), '_', GREATEST(asset_1_symbol, asset_2_symbol)) AS ticker_id,
    LEAST(asset_1_symbol, asset_2_symbol) AS base,
    GREATEST(asset_1_symbol, asset_2_symbol) AS target
FROM
    combos c
WHERE
    asset_1_symbol <> asset_2_symbol
ORDER BY
    ticker_id, base;
