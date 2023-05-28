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
SELECT
    CONCAT(asset_1_symbol || '_' || asset_2_symbol) AS ticker_id,
    asset_1_symbol AS base,
    asset_2_symbol AS target
FROM
    combos c
WHERE
    asset_1_symbol <> asset_2_symbol
ORDER BY
    1,
    2
