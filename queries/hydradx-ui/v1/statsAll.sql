-- statsAll
with src_data AS (
  SELECT *,
         floor(extract('epoch' from (MAX(timestamp) OVER (ORDER BY timestamp DESC)
                                     - MIN(timestamp) OVER (ORDER BY timestamp))) / 59) as sec_per_segment
  FROM stats_historical
  WHERE
    CASE
      WHEN :assetTicker::text IS NOT NULL
        THEN symbol = :assetTicker
      ELSE
        1=1
      END
),
segment_info AS (
  SELECT floor(extract('epoch' from (MAX(timestamp) - MIN(timestamp))) / 59) as sec_per_segment
  FROM src_data
),
series AS (
  SELECT
    generate_series(
      to_timestamp(floor((extract('epoch' from (SELECT MIN(timestamp) FROM src_data)) / sec_per_segment )) * sec_per_segment),
      to_timestamp(floor((extract('epoch' from (SELECT MAX(timestamp) FROM src_data)) / sec_per_segment )) * sec_per_segment),
      sec_per_segment * interval '1s'
    ) AS segment
  FROM
    segment_info
),
counts_intervals AS (
  SELECT
    to_timestamp(floor((extract('epoch' from timestamp) / sec_per_segment )) * sec_per_segment) AT TIME ZONE 'UTC' as segment,
    AVG(NULLIF(volume_roll_24_usd, 0)) as volume_roll_24_usd,
    AVG(NULLIF(tvl_usd, 0)) as tvl_usd,
    AVG(NULLIF(tvl_pol_usd, 0)) as tvl_pol_usd,
    SUM(volume_usd) as volume_usd
  FROM
    src_data
  GROUP BY
    1
)
SELECT series.segment as interval,
       coalesce(ci.volume_usd,0) as volume_usd,
       coalesce(ci.tvl_usd,0) as tvl_usd,
       coalesce(ci.tvl_pol_usd,0) as tvl_pol_usd,
       coalesce(ci.volume_roll_24_usd,0) as volume_roll_24_usd
FROM
  series
LEFT JOIN 
  counts_intervals ci
  on series.segment = ci.segment
ORDER BY 1