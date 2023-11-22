-- statsVolumeAlltime

/* Returns all time volume */

SELECT 
  CASE
    WHEN :asset::text IS NOT NULL THEN 
      round(SUM(volume_omnipool_roll_24_usd))
    ELSE 
      round(SUM(volume_omnipool_roll_24_usd)/2)
  END AS volume_usd
FROM (
  SELECT 
    symbol, 
    volume_omnipool_roll_24_usd, 
    timestamp,
    ROW_NUMBER() OVER (
      PARTITION BY symbol, timestamp::date
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
ORDER BY 
  1 DESC;
