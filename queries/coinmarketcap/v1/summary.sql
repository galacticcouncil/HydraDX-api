-- coinmarketcapSummary
/*
WITH omnipool_trades_all AS(
  SELECT
    substring(block_id, 4, 7):: numeric AS block,
    (args ->> 'assetIn'):: numeric AS asset_in,
    (args ->> 'assetOut'):: numeric AS asset_out,
    (args ->> 'amountIn'):: numeric AS amount_in,
    (args ->> 'amountOut'):: numeric AS amount_out,
    timestamp
  FROM
    event e
    JOIN block b ON e.block_id = b.id
  WHERE
    name IN (
      'Omnipool.SellExecuted', 'Omnipool.BuyExecuted'
    )
),
omnipool_trades_24 AS (
  SELECT
    *
  from
    omnipool_trades_all
  where
    timestamp > now() - interval '1 day'
),
hdx_changes AS (
  SELECT
    DISTINCT block_id,
    '0' AS asset_id,
    (args ->> 'amount'):: numeric AS amount
  FROM
    event
  WHERE
    name LIKE 'Balances.Transfer'
    AND args ->> 'to' = '0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000'
  UNION ALL
  SELECT
    DISTINCT block_id,
    '0' AS asset_id,
    -(args ->> 'amount'):: numeric AS amount
  FROM
    event
  WHERE
    name LIKE 'Balances.Transfer'
    AND args ->> 'from' = '0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000'
),
tokens_changes AS (
  SELECT
    block_id,
    args ->> 'currencyId' AS asset_id,
    (args ->> 'amount'):: numeric AS amount
  FROM
    event
  WHERE
    name = 'Tokens.Transfer'
    AND args ->> 'to' = '0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000'
  UNION ALL
  SELECT
    block_id,
    args ->> 'currencyId' AS asset_id,
    -(args ->> 'amount'):: numeric AS amount
  FROM
    event
  WHERE
    name = 'Tokens.Transfer'
    AND args ->> 'from' = '0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000'
  UNION ALL
  SELECT
    block_id,
    args ->> 'currencyId' AS asset_id,
    (args ->> 'amount'):: numeric AS amount
  FROM
    event
  WHERE
    name = 'Tokens.Deposited'
    AND args ->> 'who' = '0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000'
  UNION ALL
  SELECT
    block_id,
    args ->> 'currencyId' AS asset_id,
    -(args ->> 'amount'):: numeric AS amount
  FROM
    event
  WHERE
    name = 'Tokens.Withdrawn'
    AND args ->> 'who' = '0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000'
),
balance_changes AS (
  SELECT
    *
  FROM
    hdx_changes
  UNION ALL
  SELECT
    *
  FROM
    tokens_changes
),
oa_rank AS (
  SELECT
    block,
    asset_id :: text AS asset_id,
    hub_reserve / 10 ^ 12 AS hub_reserve,
    RANK() OVER (
      ORDER BY
        block DESC
    ) AS rank
  FROM
    omnipool_asset
  WHERE
    block > (SELECT MAX(block) - 14400 FROM omnipool_asset)
),
hub_reserve AS (
  SELECT
    block,
    asset_id,
    hub_reserve
  FROM
    oa_rank oa
  WHERE
    oa.rank = 1
),
token_data AS (
  SELECT
    height,
    timestamp,
    block_id,
    asset_id,
    symbol,
    decimals,
    amount,
    SUM(amount) OVER (
      PARTITION BY asset_id
      ORDER BY
        block_id
    ) / 10 ^ decimals AS balance
  FROM
    balance_changes
    JOIN block ON block_id = block.id
    JOIN token_metadata ON asset_id = token_metadata.id :: text
),
alltime_bal AS (
  SELECT
    asset_id,
    decimals,
    symbol,
    sum(amount) AS balance
  FROM
    token_data
  GROUP BY
    1,
    2,
    3
),
vol24 AS (
  SELECT
    asset_id,
    decimals,
    symbol,
    sum(
      abs(amount)
    ) AS volume
  FROM
    token_data
  WHERE
    timestamp > now() - interval '1 day'
  GROUP BY
    1,
    2,
    3
),
lrna_in_usdt AS (
  SELECT
    block,
    balance / 10 ^ decimals / hub_reserve AS lrna_price
  FROM
    alltime_bal a
    JOIN hub_reserve hr ON a.asset_id = hr.asset_id
  WHERE
    hr.asset_id = '102'
),
spot AS (
  SELECT
    hub_reserve /(ab.balance / 10 ^ ab.decimals) * lrna_price AS price,
    hub_reserve * lrna_price as liquidity,
    a.asset_id :: numeric,
    a.decimals,
    a.symbol
  FROM
    vol24 a
    JOIN hub_reserve hr ON a.asset_id = hr.asset_id
    JOIN lrna_in_usdt liu ON hr.block = liu.block
    JOIN alltime_bal ab ON a.asset_id = ab.asset_id
),
listed AS (
  SELECT
    DISTINCT asset_id
  FROM
    omnipool_asset
  WHERE
    asset_id NOT BETWEEN 100 AND 199
),
combos AS (
  SELECT
    la.asset_id AS asset_1_id,
    lb.asset_id AS asset_2_id,
    tm.symbol AS asset_1_symbol,
    tme.symbol AS asset_2_symbol
  FROM
    listed la CROSS
    JOIN listed lb
    JOIN token_metadata tm ON la.asset_id = tm.id
    JOIN token_metadata tme ON lb.asset_id = tme.id
),
pairs AS (
  SELECT
    DISTINCT
    CASE WHEN asset_1_symbol > asset_2_symbol THEN CONCAT(
      asset_1_symbol, '_', asset_2_symbol
    ) ELSE CONCAT(
      asset_2_symbol, '_', asset_1_symbol
    ) END AS ticker_id,
    CASE WHEN asset_1_symbol > asset_2_symbol THEN CONCAT(
      asset_1_id, '_', asset_2_id
    ) ELSE CONCAT(
      asset_2_id, '_', asset_1_id
    ) END AS asset_ids_concat,
    CASE WHEN asset_1_symbol > asset_2_symbol THEN asset_1_symbol ELSE asset_2_symbol END AS base_currency,
    CASE WHEN asset_1_symbol > asset_2_symbol THEN asset_2_symbol ELSE asset_1_symbol END AS target_currency
  FROM
    combos c
  WHERE
    asset_1_symbol <> asset_2_symbol
  ORDER BY
    ticker_id,
    base_currency
),
omnipool_totals AS (
  SELECT
    asset_in,
    asset_out,
    sum(amount_in) AS amount_in,
    sum(amount_out) AS amount_out
  FROM
    omnipool_trades_24
  GROUP BY
    1,
    2
),
pair_volumes AS (
  SELECT 
    CASE WHEN asset_in = 100 THEN REPLACE(asset_in::text, '100', CASE WHEN asset_out = '10' THEN '21' ELSE '10' END)
         WHEN asset_in = 101 THEN REPLACE(asset_in::text, '101', CASE WHEN asset_out = '11' THEN '19' ELSE '11' END)
         WHEN asset_in = 102 THEN REPLACE(asset_in::text, '102', CASE WHEN asset_out = '10' THEN '22' ELSE '10' END)
         ELSE asset_in::text
    END as asset_1,
    CASE WHEN asset_out = 100 THEN REPLACE(asset_out::text, '100', CASE WHEN asset_in = '10' THEN '21' ELSE '10' END)
         WHEN asset_out = 101 THEN REPLACE(asset_out::text, '101', CASE WHEN asset_in = '11' THEN '19' ELSE '11' END)
         WHEN asset_out = 102 THEN REPLACE(asset_out::text, '102', CASE WHEN asset_in = '10' THEN '22' ELSE '10' END)
         ELSE asset_out::text
    END as asset_2,
    CASE WHEN asset_in = 100 THEN REPLACE(s.symbol, '4-Pool', CASE WHEN s2.symbol = 'USDT' THEN 'USDC' ELSE 'USDT' END)
         WHEN asset_in = 101 THEN REPLACE(s.symbol, '2-Pool', CASE WHEN s2.symbol = 'iBTC' THEN 'WBTC' ELSE 'iBTC' END)
         WHEN asset_in = 102 THEN REPLACE(s.symbol, '2-Pool-Stbl', CASE WHEN s2.symbol = 'USDT' THEN 'USDC' ELSE 'USDT' END)
         ELSE s.symbol
    END as asset_1_symbol,
    CASE WHEN asset_out = 100 THEN REPLACE(s2.symbol, '4-Pool', CASE WHEN s.symbol = 'USDT' THEN 'USDC' ELSE 'USDT' END)
         WHEN asset_out = 101 THEN REPLACE(s2.symbol, '2-Pool', CASE WHEN s.symbol = 'iBTC' THEN 'WBTC' ELSE 'iBTC' END)
         WHEN asset_out = 102 THEN REPLACE(s2.symbol, '2-Pool-Stbl', CASE WHEN s.symbol = 'USDT' THEN 'USDC' ELSE 'USDT' END)
    ELSE s2.symbol END as asset_2_symbol,
    s.price as asset_1_price,
    s2.price as asset_2_price,
    amount_in / (10 ^ s.decimals) AS base_volume,
    amount_out / (10 ^ s2.decimals) AS target_volume,
    s.liquidity as liq1,
    s2.liquidity as liq2
  FROM
    omnipool_totals ot
    JOIN spot s ON ot.asset_in = s.asset_id
    JOIN spot s2 ON ot.asset_out = s2.asset_id
),
commanding_asset AS (
  select
    CASE WHEN asset_1_symbol > asset_2_symbol THEN CONCAT(
      asset_1_symbol, '_', asset_2_symbol
    ) ELSE CONCAT(
      asset_2_symbol, '_', asset_1_symbol
    ) END AS ticker_id,
    CASE WHEN asset_1_symbol > asset_2_symbol THEN CONCAT(
      asset_1, '_', asset_2
    ) ELSE CONCAT(
      asset_2, '_', asset_1
    ) END AS asset_ids_concat,
    CASE WHEN asset_1_symbol > asset_2_symbol THEN base_volume ELSE target_volume END AS base_volume,
    CASE WHEN asset_1_symbol > asset_2_symbol THEN target_volume ELSE base_volume END AS target_volume,
    asset_1_symbol,
    asset_2_symbol,
    CASE WHEN asset_1_symbol > asset_2_symbol THEN liq1 ELSE liq2 END AS liquidity
  FROM
    pair_volumes
),
dedup_pair_vol AS (
  select
    ticker_id,
    asset_ids_concat,
    liquidity,
    SUM(base_volume) AS base_volume,
    SUM(target_volume) AS target_volume
  from
    commanding_asset
  group by
    1,
    2,
    3
  order by
    1
),
command_last_trade AS(
  select
    CASE WHEN tm.symbol > tme.symbol THEN CONCAT(tm.symbol, '_', tme.symbol) ELSE CONCAT(tme.symbol, '_', tm.symbol) END AS ticker_id,
    CASE WHEN tm.symbol > tme.symbol THEN CONCAT(tm.id, '_', tme.id) ELSE CONCAT(tme.id, '_', tm.id) END AS asset_ids_concat,
    CASE WHEN tm.symbol > tme.symbol THEN tm.id ELSE tme.id END AS asset_in,
    CASE WHEN tm.symbol > tme.symbol THEN tme.id ELSE tm.id END AS asset_out,
    CASE WHEN tm.symbol > tme.symbol THEN amount_in ELSE amount_out END AS amount_in,
    CASE WHEN tm.symbol > tme.symbol THEN amount_out ELSE amount_in END AS amount_out,
    CASE WHEN tm.symbol > tme.symbol THEN tm.decimals ELSE tme.decimals END AS decimals_in,
    CASE WHEN tm.symbol > tme.symbol THEN tme.decimals ELSE tm.decimals END AS decimals_out,
    block,
    timestamp
  FROM
    omnipool_trades_all
    JOIN token_metadata tm ON asset_in = tm.id
    JOIN token_metadata tme ON asset_out = tme.id
),
trade_rank AS (
  select
    RANK() OVER (
      PARTITION BY asset_in,
      asset_out
      ORDER BY
        block DESC
    ) AS rank_latest,
    amount_in,
    amount_out,
    ticker_id,
    decimals_in,
    decimals_out,
    asset_ids_concat
  from
    command_last_trade
),
highs_lows AS (
  select
    RANK() OVER (
      PARTITION BY asset_in,
      asset_out
      ORDER BY
        (amount_out / amount_in) DESC
    ) AS rank_high,
    RANK() OVER (
      PARTITION BY asset_in,
      asset_out
      ORDER BY
        (amount_out / amount_in)
    ) AS rank_low,
    RANK() OVER (
      PARTITION BY asset_in,
      asset_out
      ORDER BY
        timestamp
    ) AS rank_24h_asc,
    RANK() OVER (
      PARTITION BY asset_in,
      asset_out
      ORDER BY
        timestamp DESC
    ) AS rank_24h_desc,
    amount_in,
    amount_out,
    ticker_id,
    decimals_in,
    decimals_out,
    asset_ids_concat
  from
    command_last_trade
  where
    timestamp > now() - interval '1 day'
),-- select * from highs_lows where ticker_id = 'WETH_DAI' order by 1,
last_trades AS (
  select
    ticker_id,
    asset_ids_concat,
    (
      amount_out /(10 ^ decimals_out)
    ) / (
      amount_in /(10 ^ decimals_in)
    ) as last_price
  from
    trade_rank
  where
    rank_latest = 1
),
lows AS (
  select
    ticker_id,
    asset_ids_concat,
    (
      amount_out /(10 ^ decimals_out)
    ) / (
      amount_in /(10 ^ decimals_in)
    ) as low
  from
    highs_lows
  where
    rank_low = 1
),
highs AS (
  select
    ticker_id,
    asset_ids_concat,
    (
      amount_out /(10 ^ decimals_out)
    ) / (
      amount_in /(10 ^ decimals_in)
    ) as high
  from
    highs_lows
  where
    rank_high = 1
),
perc_change AS (
  SELECT
    l.ticker_id,
    l.asset_ids_concat,
    (1 - (l.amount_in / l.amount_out) / (f.amount_in / f.amount_out)) * 100 as price_change_percent_24h
  FROM
      highs_lows l
  JOIN
      highs_lows f ON l.asset_ids_concat = f.asset_ids_concat
  WHERE
      l.rank_24h_desc = 1 AND f.rank_24h_asc = 1
)
SELECT
  p.ticker_id as trading_pairs,
  base_currency,
  target_currency as quote_currency,
  COALESCE(avg(last_price), 0) as last_price,
  COALESCE(avg(low), 0) as lowest_ask,
  COALESCE(avg(high), 0) as highest_bid,
  sum(COALESCE(base_volume, 0)) as base_volume,
  sum(COALESCE(target_volume, 0)) as target_volume,
  COALESCE(avg(pc.price_change_percent_24h), 0) as price_change_percent_24h,
  COALESCE(avg(high), 0) as highest_price_24h,
  COALESCE(avg(low), 0) as lowest_price_24h
FROM
  pairs p
  left join last_trades lt on p.asset_ids_concat = lt.asset_ids_concat
  left join highs h on h.asset_ids_concat = lt.asset_ids_concat
  left join lows l on l.asset_ids_concat = lt.asset_ids_concat
  left join dedup_pair_vol pv on pv.asset_ids_concat = p.asset_ids_concat
  left join perc_change pc on pc.asset_ids_concat = p.asset_ids_concat
GROUP BY 1,2,3
*/