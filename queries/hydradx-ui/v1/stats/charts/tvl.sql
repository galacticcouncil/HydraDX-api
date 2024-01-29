-- statsChartTvl

/* Returns 60 rows with all time TVL in USD */

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
),
ordered_data AS (
    SELECT 
        s.start as "timestamp",
        round(sum(oa.hub_reserve/10^12 * src.last_lrna_price)) as tvl_usd,
        ROW_NUMBER() OVER(ORDER BY s.start DESC) as desc_rn
    FROM 
        src_data src
        JOIN omnipool_asset oa ON src.height = oa.block
        JOIN segment s ON s.start = src.segment
        JOIN token_metadata tm ON oa.asset_id = tm.id
    WHERE 
        src.rn = 1
        AND CASE
            WHEN :asset::text IS NOT NULL
            THEN asset_id = :asset
            ELSE
            true
            END
    GROUP BY
        s.start
),
actual_tvl as (
    SELECT round(sum(oa.hub_reserve / 10 ^ 12 * leb.last_lrna_price)) as tvl_usd,
           MAX(timestamp) as timestamp
    FROM lrna_every_block leb
            JOIN (SELECT LEAST(max_leb.max_height, max_oa.max_block) AS joined_height
                  FROM (SELECT MAX(height) as max_height FROM lrna_every_block) max_leb,
                       (SELECT MAX(block) as max_block FROM omnipool_asset) max_oa) subq
                 ON leb.height = subq.joined_height
            JOIN omnipool_asset oa ON leb.height = oa.block
            JOIN token_metadata tm ON oa.asset_id = tm.id
    WHERE CASE
             WHEN :asset::text IS NOT NULL
                 THEN asset_id = :asset
             ELSE
                 true
             END
)
SELECT 
    CASE 
        WHEN desc_rn = 1 THEN TO_CHAR((SELECT timestamp FROM actual_tvl), 'YYYY-MM-DD HH24:MI:SS')
        ELSE TO_CHAR("timestamp", 'YYYY-MM-DD HH24:MI:SS')
    END AS "timestamp",
    CASE
        WHEN desc_rn = 1 THEN (SELECT tvl_usd FROM actual_tvl)
        ELSE tvl_usd
    END
FROM 
    ordered_data
ORDER BY 
    "timestamp"
LIMIT 60;
