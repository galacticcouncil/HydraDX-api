-- statsPrice

/* Returns current asset price */

SELECT 
  price_usd
FROM (
  SELECT 
    price_usd,
    ROW_NUMBER() OVER (
      PARTITION BY asset_id 
      ORDER BY timestamp DESC
    ) AS rn 
  FROM 
    stats_historical
  WHERE
    asset_id = :asset
) a 
WHERE 
  rn = 1
