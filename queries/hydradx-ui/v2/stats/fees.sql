-- statsFees

/* Returns fees and projected LP APY
based on past :timeframe = 1d, 1w, 1mon, 1y
*/

WITH fees AS (
    SELECT 
        COALESCE(q1.asset_id, q2.asset_id) AS asset_id,
        COALESCE(q1.amount, 0) + COALESCE(q2.amount, 0) AS amount
    FROM 
        (SELECT 
             CAST(args ->> 'assetOut' AS numeric) AS asset_id, 
             SUM(CAST(args ->> 'assetFeeAmount' AS numeric)) AS amount 
         FROM event e 
         JOIN block b ON e.block_id = b.id
         WHERE timestamp > NOW() - :timeframe::interval 
         AND name = 'Omnipool.SellExecuted'
         AND
            CASE
            WHEN :asset::text IS NOT NULL
                THEN CAST(args ->> 'assetOut' AS numeric) = :asset
            ELSE
                true
            END
         GROUP BY 1) AS q1
    FULL OUTER JOIN 
        (SELECT 
             CAST(args ->> 'assetIn' AS numeric) AS asset_id, 
             SUM(CAST(args ->> 'assetFeeAmount' AS numeric)) AS amount 
         FROM event e 
         JOIN block b ON e.block_id = b.id
         WHERE timestamp > NOW() - :timeframe::interval 
         AND name = 'Omnipool.BuyExecuted'
         AND
            CASE
            WHEN :asset::text IS NOT NULL
                THEN CAST(args ->> 'assetIn' AS numeric) = :asset
            ELSE
                true
            END
         GROUP BY 1) AS q2
    ON q1.asset_id = q2.asset_id
),
last_price AS (
    SELECT
        asset_id,
        price_usd
    FROM (
        SELECT 
            asset_id,
            price_usd,
            ROW_NUMBER() OVER (
                PARTITION BY asset_id 
                ORDER BY timestamp DESC
            ) AS rn 
        FROM 
            stats_historical
    ) a 
    WHERE 
        rn = 1
    UNION
        (SELECT 1 AS asset_id, last_lrna_price AS price_usd FROM lrna_every_block ORDER BY 1 DESC LIMIT 1)
),
tvl AS (
    SELECT
        asset_id,
        ROUND(SUM(oa.hub_reserve / 10^12 * leb.last_lrna_price)) AS asset_tvl
    FROM 
        lrna_every_block leb
        JOIN (
            SELECT 
                LEAST(max_leb.max_height, max_oa.max_block) AS joined_height
            FROM 
                (SELECT MAX(height) AS max_height FROM lrna_every_block) max_leb,
                (SELECT MAX(block) AS max_block FROM omnipool_asset) max_oa
        ) subq ON leb.height = subq.joined_height
        JOIN omnipool_asset oa ON leb.height = oa.block
        JOIN token_metadata tm ON oa.asset_id = tm.id
    GROUP BY 1
)
SELECT 
    tm.id as asset_id,
    round(sum((amount / 10^decimals) * price_usd)::numeric, 2) AS accrued_fees_usd,
    round(avg((POWER(1 + COALESCE((amount / 10^decimals) * price_usd, 0) / asset_tvl, parts) - 1)::numeric), 4) * 100 AS projected_apy_perc,
    round(avg(COALESCE((amount / 10^decimals) * price_usd, 0) / asset_tvl * parts)::numeric, 4) * 100 AS projected_apr_perc
FROM 
    fees
    JOIN token_metadata tm ON asset_id = tm.id
    JOIN last_price lp ON tm.id = lp.asset_id
    JOIN tvl ON tm.id = tvl.asset_id
    CROSS JOIN (SELECT 
                    CASE 
                        WHEN :timeframe = '1d' THEN 365
                        WHEN :timeframe = '1w' THEN 52
                        WHEN :timeframe = '1mon' THEN 12
                        WHEN :timeframe = '1y' THEN 1
                        ELSE 12 -- default to monthly if timeframe not recognized
                    END AS parts
                ) AS interval_calc
GROUP BY 1