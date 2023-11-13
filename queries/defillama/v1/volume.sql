-- defillamaVolume

/* Returns actual 24h rolling volume */

SELECT 
  CASE
      WHEN :asset::integer IS NOT NULL
      THEN 
        SUM(round(volume_roll_24_usd))
      ELSE
        SUM(round(volume_roll_24_usd/2))
  END as volume_usd
FROM (
  SELECT 
    symbol, 
    volume_roll_24_usd, 
    ROW_NUMBER() OVER (
      PARTITION BY symbol 
      ORDER BY timestamp DESC
    ) AS rn 
  FROM 
    stats_historical
  WHERE
  CASE
    WHEN :asset::text IS NOT NULL
      THEN symbol = :asset
    ELSE
      true
  END
) a 
WHERE 
  rn = 1
