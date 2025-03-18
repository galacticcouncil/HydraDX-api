-- statsChartVolume

/*
:timeframe = hourly
Returns 24 rows with volume in USD, one hourly for last 24 hours, last record is for last hour

:timeframe = daily
Returns 30 rows with volume in USD, one daily for last 30d, last record is for yesterday
*/

WITH DailyVolume AS (
  SELECT DISTINCT ON (timestamp::date, asset_id)
    timestamp::date AS "timestamp",
    CASE
      WHEN :asset::text IS NOT NULL
        THEN round(volume_roll_24_usd)
      ELSE
        round(volume_roll_24_usd / 2)
    END AS volume_usd,
    'daily' AS type
  FROM stats_historical
  WHERE
    timestamp BETWEEN now() - interval '30d' AND (current_date::timestamp) - interval '1 microsecond'
    AND
    (:asset::text IS NULL OR asset_id = :asset)
)

, HourlyVolume AS (
  SELECT
    date_trunc('hour', timestamp) as "timestamp",
    CASE
      WHEN :asset::text IS NOT NULL
        THEN round(sum(volume_usd))
      ELSE
        round(sum(volume_usd) / 2)
    END AS volume_usd,
    'hourly' AS type
  FROM stats_historical
  WHERE
    timestamp BETWEEN now() - interval '24h' AND date_trunc('hour', now()) - interval '1 microsecond'
    AND
    (:asset::text IS NULL OR asset_id = :asset)
  GROUP BY 1
)

SELECT
  timestamp,
  sum(volume_usd) AS volume_usd
FROM (
  SELECT * FROM DailyVolume
  UNION ALL
  SELECT * FROM HourlyVolume
) AS CombinedQuery
WHERE
  type = CASE
          WHEN :timeframe = 'hourly' THEN 'hourly'
          ELSE 'daily'
         END
GROUP BY timestamp
ORDER BY timestamp;