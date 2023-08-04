-- Returns 60 rows with all time TVL in USD

WITH min_max AS (
  SELECT 
    MIN(timestamp) as min_timestamp, 
    MAX(timestamp) as max_timestamp 
  FROM 
    lrna_every_block 
),
launch AS (
  SELECT ceiling(EXTRACT(EPOCH FROM (now() - min_timestamp)) / 59) as time
  FROM min_max
),
segment AS (
  SELECT 
    generate_series(
      to_timestamp(ceiling((extract('epoch' from min_timestamp) / time)) * time) AT TIME ZONE 'UTC',
      to_timestamp(ceiling((extract('epoch' from max_timestamp) / time)) * time) AT TIME ZONE 'UTC',
      time * '1s'::interval
    ) AS start
  FROM 
    min_max, launch
),
src_data AS (
  SELECT 
    leb.timestamp,
    leb.last_lrna_price,
    leb.height,
    to_timestamp(ceiling((extract('epoch' from leb.timestamp) / time)) * time) AT TIME ZONE 'UTC' as segment,
    row_number() OVER (PARTITION BY to_timestamp(ceiling((extract('epoch' from leb.timestamp) / time)) * time) AT TIME ZONE 'UTC' ORDER BY leb.timestamp DESC) as rn
  FROM 
    lrna_every_block leb, launch 
)
SELECT 
  s.start as interval,
  round(sum(oa.hub_reserve/10^12 * src.last_lrna_price)) as tvl_usd
FROM 
  src_data src
  JOIN omnipool_asset oa ON src.height = oa.block
  JOIN segment s ON s.start = src.segment
  JOIN token_metadata tm ON oa.asset_id = tm.id
WHERE 
  src.rn = 1
  --AND symbol = 'DAI'
GROUP BY 
  s.start
ORDER BY 
  s.start;