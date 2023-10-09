-- statsVolume

/* 
:timeframe = hourly
Returns 24 rows with volume in USD, one hourly for last 24 hours, last record is for last hour 

:timeframe = daily
Returns 30 rows with volume in USD, one daily for last 30d, last record is for yesterday
*/

WITH CombinedQuery AS (
  SELECT 
    timestamp::date as "timestamp",
    round(sum(volume_usd)/2) as volume_usd,
    'daily' as type
  FROM 
    stats_historical
  WHERE 
    timestamp between now() - interval '30d' and (current_date::timestamp) - interval '1 microsecond'
    AND
     CASE
      WHEN :asset::text IS NOT NULL
        THEN asset_id = :asset::integer
      ELSE
        true
    END
  GROUP BY 1
  UNION ALL
  SELECT 
    date_trunc('hour', timestamp) as "timestamp",
    round(sum(volume_usd)/2) as volume_usd,
    'hourly' as type
  FROM 
    stats_historical
  WHERE 
    timestamp between now() - interval '24h' and date_trunc('hour', now()) - interval '1 microsecond'
    AND
     CASE
      WHEN :asset::text IS NOT NULL
        THEN asset_id = :asset::integer
      ELSE
        true
    END
  GROUP BY 1
)
SELECT 
  timestamp,
  volume_usd
FROM 
  CombinedQuery
WHERE
  type = CASE
          WHEN :timeframe = 'hourly' THEN 'hourly'
          ELSE 'daily'
         END
ORDER BY 
  timestamp;
