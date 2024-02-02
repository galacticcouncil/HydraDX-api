-- getPairs
WITH listed AS (
  SELECT
    DISTINCT asset_id
  FROM
    omnipool_asset
  WHERE
    asset_id NOT BETWEEN 100 AND 199
  UNION SELECT 10
  UNION SELECT 22
),
combos AS (
  SELECT
    la.asset_id AS asset_1_id,
    lb.asset_id AS asset_2_id,
    tm.symbol AS asset_1_symbol,
    tme.symbol AS asset_2_symbol
  FROM
    listed la CROSS
    JOIN listed lb
    JOIN token_metadata tm ON la.asset_id = tm.id
    JOIN token_metadata tme ON lb.asset_id = tme.id
)
SELECT
DISTINCT
CASE WHEN asset_1_id > asset_2_id THEN CONCAT(
  asset_1_symbol, '_', asset_2_symbol
) ELSE CONCAT(
  asset_2_symbol, '_', asset_1_symbol
) END AS ticker_id,
CASE WHEN asset_1_id > asset_2_id THEN asset_1_symbol ELSE asset_2_symbol END AS base,
CASE WHEN asset_1_id > asset_2_id THEN asset_2_symbol ELSE asset_1_symbol END AS target
FROM
    combos c
WHERE
    asset_1_symbol <> asset_2_symbol
ORDER BY
    ticker_id,
    base