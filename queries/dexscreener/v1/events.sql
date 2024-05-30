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
    
    SELECT DISTINCT
        e1.block_id,
        e1.extrinsic_id,
        e1.args ->> 'currencyId' AS asset_1_id,
        CASE
            WHEN e1.args ->> 'currencyId' = e2.args ->> 'assetA' THEN e2.args ->> 'assetB'
            ELSE e2.args ->> 'assetA'
        END AS asset_2_id,
        CAST(e1.args ->> 'amount' AS numeric) AS amount_1,
        CAST(e2.args ->> 'initialSharesAmount' AS numeric) AS amount_2,
        e2.args ->> 'who' AS sender,
        'join' AS eventType,
        e1.index_in_block,
        e1.pos,
        e2.args ->> 'pool' AS pairId
    FROM event e1
    JOIN event e2 ON e1.args ->> 'who' = e2.args ->> 'pool' AND e1.block_id = e2.block_id
    WHERE e1.name = 'Tokens.Endowed' AND e2.name = 'XYK.PoolCreated'
    
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
        1 AS index_in_block,
        2 AS pos,
        e1.args ->> 'to' AS pairId
    FROM event e1
    JOIN event e2 ON e1.args ->> 'from' = e2.args ->> 'who' AND e1.block_id = e2.block_id AND e1.extrinsic_id = e2.extrinsic_id
    WHERE e1.name = 'Currencies.Transferred' AND e2.name = 'XYK.LiquidityAdded'
    AND (
        e1.args ->> 'to' = (SELECT DISTINCT id FROM pools WHERE asset0Id = e2.args ->> 'assetA' AND asset1Id = e2.args ->> 'assetB')
        OR e1.args ->> 'to' = (SELECT DISTINCT id FROM pools WHERE asset0Id = e2.args ->> 'assetB' AND asset1Id = e2.args ->> 'assetA')
    )
    
    UNION ALL
    
    SELECT DISTINCT
        e1.block_id,
        e1.extrinsic_id,
        e1.args ->> 'currencyId' AS asset_1_id,
        CASE
            WHEN e1.args ->> 'currencyId' = e2.args ->> 'assetA' THEN e2.args ->> 'assetB'
            ELSE e2.args ->> 'assetA'
        END AS asset_2_id,
        -CAST(e1.args ->> 'amount' AS numeric) AS amount_1,
        0 AS amount_2,
        e2.args ->> 'who' AS sender,
        'exit' AS eventType,
        e1.index_in_block,
        e1.pos,
        e1.args ->> 'from' AS pairId
    FROM event e1
    JOIN event e2 ON e1.args ->> 'to' = e2.args ->> 'who' AND e1.block_id = e2.block_id
    WHERE e1.name = 'Currencies.Transferred' AND e2.name = 'XYK.LiquidityRemoved' AND NOT (e1.args ->> 'amount' = '1000000000000' AND e1.args ->> 'currencyId' = '0')
),
xyk_casted AS (
    SELECT
        block_id,
        extrinsic_id,
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
        xyk.eventType,
        xyk.extrinsic_id AS txnId,
        xyk.index_in_block AS txnIndex,
        xyk.pos AS eventIndex,
        xyk.sender AS maker,
        xyk.pairId,
        xyk.asset_1_id AS asset0In,
        xyk.asset_2_id AS asset1Out,
        xyk.amount_1,
        xyk.amount_2,
        tm.decimals AS decimals_1,
        tme.decimals AS decimals_2,
        SUM(xyk.amount_1) OVER (PARTITION BY xyk.asset_1_id, xyk.asset_2_id ORDER BY block.timestamp) / 10^tm.decimals AS reserves_asset_0,
        SUM(xyk.amount_2) OVER (PARTITION BY xyk.asset_1_id, xyk.asset_2_id ORDER BY block.timestamp) / 10^tme.decimals AS reserves_asset_1
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
    asset0In,
    asset1Out,
    ABS(amount_2) / 10^decimals_2 / (ABS(amount_1) / 10^decimals_1) AS priceNative,
    reserves_asset_0 AS reservesAsset0,
    reserves_asset_1 AS reservesAsset1
FROM xyk_aggr
WHERE eventType <> 'exit'
AND blockNumber BETWEEN :fromBlock AND :toBlock
ORDER BY blockNumber DESC;