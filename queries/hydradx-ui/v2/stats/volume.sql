-- statsVolume

/* Returns actual 24h rolling volume */

SELECT 
  asset_id,
  ROUND(SUM(volume_roll_24_usd)) as volume_usd
FROM (
  SELECT 
    symbol,
    asset_id,
    volume_roll_24_usd,
    timestamp,
    ROW_NUMBER() OVER (
      PARTITION BY symbol 
      ORDER BY timestamp DESC
    ) AS rn 
  FROM 
    stats_historical
  WHERE
  CASE
    WHEN :asset::text IS NOT NULL
      THEN asset_id = :asset
    ELSE
      true
  END
) a 
WHERE 
  rn = 1
AND
  timestamp > now () - interval '1d'
GROUP BY 1