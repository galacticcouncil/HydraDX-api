-- statsPeriodic
with src_data AS (
  SELECT *
  FROM stats_historical
  WHERE
  CASE
    WHEN :assetTicker::text IS NOT NULL
      THEN symbol = :assetTicker
    ELSE
      1=1
    END
  AND timestamp > (SELECT MAX(timestamp) FROM stats_historical) - :sqlQuerySecondsLabel::interval * 60
),
series AS (
  SELECT
    generate_series(
      to_timestamp(ceiling((extract('epoch' from (SELECT MIN(timestamp) FROM src_data)) / :sqlQuerySeconds )) * :sqlQuerySeconds),
      to_timestamp(floor((extract('epoch' from (SELECT MAX(timestamp) FROM src_data)) / :sqlQuerySeconds )) * :sqlQuerySeconds),
      :sqlQuerySecondsLabel
    ) AS segment
),
counts_intervals AS (
  SELECT
    to_timestamp(floor((extract('epoch' from timestamp) / :sqlQuerySeconds )) * :sqlQuerySeconds) AT TIME ZONE 'UTC' as segment,
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
order by 1
