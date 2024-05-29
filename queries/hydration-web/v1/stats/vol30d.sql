-- statsVol30d
SELECT
  ROUND(SUM(volume_roll_24_usd)) as volume_usd
FROM (
  SELECT 
    symbol,
    asset_id,
    volume_roll_24_usd,
    timestamp,
    ROW_NUMBER() OVER (
      PARTITION BY symbol, timestamp::date
      ORDER BY timestamp DESC
    ) AS rn 
  FROM 
    stats_historical
) a 
WHERE 
  rn = 1
AND
  timestamp > now () - interval '30d'
