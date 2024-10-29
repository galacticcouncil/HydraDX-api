-- dexscreenerEvents

/*
  Returns all events within a certain range
*/

WITH pools AS (
    SELECT
        args ->> 'pool' AS id,
        args ->> 'assetA' AS asset0Id,
        args ->> 'assetB' AS asset1Id
    FROM event
    WHERE name = 'XYK.PoolCreated'
),
remove_data AS (
  SELECT DISTINCT
        e1.block_id,
        e1.extrinsic_id,
        e1.args ->> 'currencyId' AS asset_1_id,
        CASE
            WHEN e1.args ->> 'currencyId' = e2.args ->> 'assetA' THEN e2.args ->> 'assetB'
            ELSE e2.args ->> 'assetA'
        END AS asset_2_id,
        e2.args ->> 'who' AS sender,
        'exit' AS eventType,
        e2.index_in_block,
        e2.pos,
        e1.args ->> 'from' AS pairId,
        CAST(e1.args ->> 'amount' AS numeric) AS e1_amount,
        CAST(e2.args ->> 'amount' AS numeric) AS e2_amount,
        row_number() over (partition by e1.block_id,e1.extrinsic_id order by cast(e1.args ->> 'currencyId' as numeric)) as rn
    FROM event e1
    JOIN event e2 ON e1.args ->> 'to' = e2.args ->> 'who' AND e1.block_id = e2.block_id
    WHERE e1.name = 'Currencies.Transferred' AND e2.name = 'XYK.LiquidityRemoved' AND NOT (e1.args ->> 'amount' = '1000000000000' AND e1.args ->> 'currencyId' = '0')
),
rn1 AS (
    SELECT *
    FROM remove_data
    WHERE rn = 1
),
rn2 AS (
    SELECT *
    FROM remove_data
    WHERE rn = 2
),
join_data AS (
    SELECT DISTINCT
        e1.block_id,
        e2.extrinsic_id,
        e1.args ->> 'currencyId' AS asset_1_id,
        CASE
            WHEN e1.args ->> 'currencyId' = e2.args ->> 'assetA' THEN e2.args ->> 'assetB'
            ELSE e2.args ->> 'assetA'
        END AS asset_2_id,
        CAST(e1.args ->> 'amount' AS numeric) AS amount_1,
        0 AS amount_2,
        e2.args ->> 'who' AS sender,
        'join' AS eventType,
        e2.index_in_block,
        e2.pos,
        e2.args ->> 'pool' AS pairId,
        row_number() over (partition by e1.block_id,e1.extrinsic_id order by cast(e1.args ->> 'currencyId' as numeric)) as rn
    FROM event e1
    JOIN event e2 ON e1.args ->> 'to' = e2.args ->> 'pool' AND e1.block_id = e2.block_id
    WHERE e1.name = 'Currencies.Transferred' AND e2.name = 'XYK.PoolCreated'
),
jn1 AS (
    SELECT *
    FROM join_data
    WHERE rn = 1
),
jn2 AS (
    SELECT *
    FROM join_data
    WHERE rn = 2
),
xyk AS (
    SELECT DISTINCT
        block_id,
        extrinsic_id,
        args ->> 'assetIn' AS asset_1_id,
        args ->> 'assetOut' AS asset_2_id,
        CAST(args ->> 'buyPrice' AS numeric) AS amount_1,
        -CAST(args ->> 'amount' AS numeric) AS amount_2,
        args ->> 'who' AS sender,
        'swap' AS eventType,
        index_in_block,
        pos,
        args ->> 'pool' AS pairId
    FROM event e
    WHERE name = 'XYK.BuyExecuted'

    UNION ALL

    SELECT DISTINCT
        block_id,
        extrinsic_id,
        args ->> 'assetIn' AS asset_1_id,
        args ->> 'assetOut' AS asset_2_id,
        CAST(args ->> 'amount' AS numeric) AS amount_1,
        -CAST(args ->> 'salePrice' AS numeric) AS amount_2,
        args ->> 'who' AS sender,
        'swap' AS eventType,
        index_in_block,
        pos,
        args ->> 'pool' AS pairId
    FROM event e
    WHERE name = 'XYK.SellExecuted'

    UNION ALL

    SELECT
        j1.block_id,
        j1.extrinsic_id,
        j1.asset_1_id,
        j1.asset_2_id,
        j1.amount_1,
        j2.amount_1 as amount_2,
        j1.sender,
        j1.eventType,
        j1.index_in_block,
        j1.pos,
        j1.pairId
    FROM jn1 j1
    LEFT JOIN jn2 j2 ON j1.block_id = j2.block_id AND j1.extrinsic_id = j2.extrinsic_id

    UNION ALL

    SELECT DISTINCT
        e1.block_id,
        e1.extrinsic_id,
        e2.args ->> 'assetA' AS asset_1_id,
        e2.args ->> 'assetB' AS asset_2_id,
        CAST(e2.args ->> 'amountA' AS numeric) AS amount_1,
        CAST(e2.args ->> 'amountB' AS numeric) AS amount_2,
        e2.args ->> 'who' AS sender,
        'join' AS eventType,
        e2.index_in_block,
        e2.pos,
        e1.args ->> 'to' AS pairId
    FROM event e1
    JOIN event e2 ON e1.args ->> 'from' = e2.args ->> 'who' AND e1.block_id = e2.block_id AND e1.extrinsic_id = e2.extrinsic_id
    WHERE e1.name = 'Currencies.Transferred' AND e2.name = 'XYK.LiquidityAdded'
    AND (
        e1.args ->> 'to' = (SELECT DISTINCT id FROM pools WHERE asset0Id = e2.args ->> 'assetA' AND asset1Id = e2.args ->> 'assetB')
        OR e1.args ->> 'to' = (SELECT DISTINCT id FROM pools WHERE asset0Id = e2.args ->> 'assetB' AND asset1Id = e2.args ->> 'assetA')
    )

    UNION ALL

    SELECT
        r1.block_id,
        r1.extrinsic_id,
        r1.asset_1_id,
        r1.asset_2_id,
        -r1.e1_amount,
        -r2.e1_amount AS e2_amount,
        r1.sender,
        r1.eventType,
        r1.index_in_block,
        r1.pos,
        r1.pairId
    FROM rn1 r1
    LEFT JOIN rn2 r2 ON r1.block_id = r2.block_id AND r1.extrinsic_id = r2.extrinsic_id
),
xyk_casted AS (
    SELECT
        block_id,
        extrinsic_id,
        CAST((regexp_matches(extrinsic_id, '-([0-9]+)-'))[1] AS INTEGER) AS extrinsic_index,
        CAST(asset_1_id AS numeric) AS asset_1_id,
        CAST(asset_2_id AS numeric) AS asset_2_id,
        CAST(amount_1 AS numeric) AS amount_1,
        CAST(amount_2 AS numeric) AS amount_2,
        sender,
        eventType,
        index_in_block,
        pos,
        pairId
    FROM xyk
),
xyk_ordered AS (
    SELECT
        block_id,
        extrinsic_id,
        extrinsic_index,
        asset_1_id as asset_in_id,
        asset_2_id as asset_out_id,
        CASE WHEN asset_1_id < asset_2_id THEN asset_1_id ELSE asset_2_id END AS asset_1_id,
        CASE WHEN asset_1_id < asset_2_id THEN asset_2_id ELSE asset_1_id END AS asset_2_id,
        CASE WHEN asset_1_id < asset_2_id THEN amount_1 ELSE amount_2 END AS amount_1,
        CASE WHEN asset_1_id < asset_2_id THEN amount_2 ELSE amount_1 END AS amount_2,
        sender,
        eventType,
        index_in_block,
        pos,
        pairId
    FROM xyk_casted
),
xyk_aggr AS (
    SELECT
        block.height AS blockNumber,
        CAST(EXTRACT(EPOCH FROM block.timestamp) AS bigint) AS blockTimestamp,
        CASE WHEN xyk.eventType = 'swap' AND asset_1_id = asset_in_id THEN 'buy'
             WHEN xyk.eventType = 'swap' AND asset_1_id = asset_out_id THEN 'sell'
             ELSE xyk.eventType
        END AS eventType,
        concat(block.height, '-', xyk.extrinsic_index) AS txnId,
        xyk.extrinsic_index AS txnIndex,
        concat(block.height, '-', xyk.index_in_block) AS eventIndex,
        xyk.sender AS maker,
        xyk.pairId,
        ABS(xyk.amount_1 / 10^tm.decimals) AS amount0,
        ABS(xyk.amount_2 / 10^tme.decimals) AS amount1,
        SUM(xyk.amount_1) OVER (PARTITION BY xyk.asset_1_id, xyk.asset_2_id ORDER BY block.timestamp) / 10^tm.decimals AS reserves_asset_0,
        SUM(xyk.amount_2) OVER (PARTITION BY xyk.asset_1_id, xyk.asset_2_id ORDER BY block.timestamp) / 10^tme.decimals AS reserves_asset_1,
        asset_1_id,
        asset_2_id
    FROM xyk_ordered xyk
    JOIN block ON xyk.block_id = block.id
    JOIN token_metadata_dexscreener tm ON xyk.asset_1_id = tm.id
    JOIN token_metadata_dexscreener tme ON xyk.asset_2_id = tme.id
)
SELECT
    blockNumber,
    blockTimestamp,
    eventType,
    txnId,
    txnIndex,
    eventIndex,
    maker,
    pairId,
    amount0,
    amount1,
    amount1 / amount0 AS priceNative,
    reserves_asset_0 AS reservesAsset0,
    reserves_asset_1 AS reservesAsset1,
    asset_1_id,
    asset_2_id
FROM xyk_aggr
WHERE reserves_asset_0 > 0 AND reserves_asset_1 > 0 AND amount0 > 0 AND amount1 > 0
AND blockNumber BETWEEN :fromBlock AND :toBlock
ORDER BY blockNumber DESC;