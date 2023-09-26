-- priceChart

WITH nor_trades AS (
  SELECT 
    timestamp,
    block.height AS block,
    args->>'who' AS who,
    name AS operation,
    token_metadata_in.symbol AS asset_in,
    token_metadata_out.symbol AS asset_out,
    (args->>'amountIn')::numeric / (10 ^ token_metadata_in.decimals) AS amount_in,
    (args->>'amountOut')::numeric / (10 ^ token_metadata_out.decimals) AS amount_out
  FROM event
  INNER JOIN block ON block_id = block.id
  INNER JOIN token_metadata AS token_metadata_in ON (args->>'assetIn')::integer = token_metadata_in.id
  INNER JOIN token_metadata AS token_metadata_out ON (args->>'assetOut')::integer = token_metadata_out.id
  WHERE name IN ('Omnipool.BuyExecuted', 'Omnipool.SellExecuted')
  AND timestamp BETWEEN '2023-01-06T13:00:00.000Z' AND :endOfDay
),
pair_price AS (
  SELECT 
    timestamp,
    CASE 
      WHEN asset_in = :assetIn AND asset_out = :assetOut AND amount_in != 0 AND amount_out != 0 THEN amount_in / amount_out
      WHEN asset_in = :assetOut AND asset_out = :assetIn AND amount_in != 0 AND amount_out != 0 THEN amount_out / amount_in
    END AS price
  FROM nor_trades
)
SELECT
  floor(extract(epoch from "timestamp")/3600)*3600 AS "time",
  max(price) AS "price"
FROM pair_price
WHERE price IS NOT NULL
GROUP BY 1
ORDER BY 1;
