-- getTickers
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
    block > (SELECT MAX(block) - 14400 /*2days*/ FROM omnipool_asset)
  
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
lrna_in_dai AS (
  SELECT 
    block, 
    balance / 10 ^ decimals / hub_reserve AS lrna_price 
  FROM 
    alltime_bal a 
    JOIN hub_reserve hr ON a.asset_id = hr.asset_id 
  WHERE 
    symbol = 'DAI'
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
    JOIN lrna_in_dai lid ON hr.block = lid.block 
    JOIN alltime_bal ab ON a.asset_id = ab.asset_id
), 
listed AS (
  SELECT 
    DISTINCT asset_id 
  FROM 
    omnipool_asset
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
    DISTINCT CASE WHEN asset_1_id > asset_2_id THEN CONCAT(
      asset_1_symbol, '_', asset_2_symbol
    ) ELSE CONCAT(
      asset_2_symbol, '_', asset_1_symbol
    ) END AS ticker_id, 
    CASE WHEN asset_1_id > asset_2_id THEN asset_1_symbol ELSE asset_2_symbol END AS base_currency, 
    CASE WHEN asset_1_id > asset_2_id THEN asset_2_symbol ELSE asset_1_symbol END AS target_currency 
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
    asset_in as asset_1, 
    asset_out as asset_2, 
    s.symbol as asset_1_symbol, 
    s2.symbol as asset_2_symbol, 
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
    CASE WHEN asset_1 > asset_2 THEN CONCAT(
      asset_1_symbol, '_', asset_2_symbol
    ) ELSE CONCAT(
      asset_2_symbol, '_', asset_1_symbol
    ) END AS ticker_id, 
    CASE WHEN asset_1 > asset_2 THEN base_volume ELSE target_volume END AS base_volume, 
    CASE WHEN asset_1 > asset_2 THEN target_volume ELSE base_volume END AS target_volume, 
    asset_1_symbol, 
    asset_2_symbol, 
    CASE WHEN asset_1 > asset_2 THEN liq1 ELSE liq2 END AS liquidity 
  FROM 
    pair_volumes
), 
dedup_pair_vol AS (
  select 
    ticker_id, 
    liquidity, 
    SUM(base_volume) AS base_volume, 
    SUM(target_volume) AS target_volume 
  from 
    commanding_asset 
  group by 
    1, 
    2 
  order by 
    1
), 
command_last_trade AS(
  select 
    CASE WHEN asset_in > asset_out THEN CONCAT(tm.symbol, '_', tme.symbol) ELSE CONCAT(tme.symbol, '_', tm.symbol) END AS ticker_id, 
    CASE WHEN asset_in > asset_out THEN tm.id ELSE tme.id END AS asset_in, 
    CASE WHEN asset_in > asset_out THEN tme.id ELSE tm.id END AS asset_out, 
    CASE WHEN asset_in > asset_out THEN amount_in ELSE amount_out END AS amount_in, 
    CASE WHEN asset_in > asset_out THEN amount_out ELSE amount_in END AS amount_out, 
    CASE WHEN asset_in > asset_out THEN tm.decimals ELSE tme.decimals END AS decimals_in, 
    CASE WHEN asset_in > asset_out THEN tme.decimals ELSE tm.decimals END AS decimals_out, 
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
    decimals_out 
  from 
    command_last_trade
), 
highs_lows AS (
  select 
    RANK() OVER (
      PARTITION BY asset_in, 
      asset_out 
      ORDER BY 
        (amount_in / amount_out) DESC
    ) AS rank_high, 
    RANK() OVER (
      PARTITION BY asset_in, 
      asset_out 
      ORDER BY 
        (amount_in / amount_out)
    ) AS rank_low, 
    amount_in, 
    amount_out, 
    ticker_id, 
    decimals_in, 
    decimals_out 
  from 
    command_last_trade 
  where 
    timestamp > now() - interval '1 day'
), 
last_trades AS (
  select 
    ticker_id, 
    (
      amount_in /(10 ^ decimals_in)
    ) / (
      amount_out /(10 ^ decimals_out)
    ) as last_price 
  from 
    trade_rank 
  where 
    rank_latest = 1
), 
lows AS (
  select 
    ticker_id, 
    (
      amount_in /(10 ^ decimals_in)
    ) / (
      amount_out /(10 ^ decimals_out)
    ) as low 
  from 
    highs_lows 
  where 
    rank_low = 1
), 
highs AS (
  select 
    ticker_id, 
    (
      amount_in /(10 ^ decimals_in)
    ) / (
      amount_out /(10 ^ decimals_out)
    ) as high 
  from 
    highs_lows 
  where 
    rank_high = 1
) 
SELECT 
  p.ticker_id, 
  base_currency, 
  target_currency, 
  COALESCE(last_price, 0) as last_price, 
  COALESCE(base_volume, 0) as base_volume, 
  COALESCE(target_volume, 0) as target_volume, 
  p.ticker_id as pool_id, 
  COALESCE(liquidity, 0) as liquidity_in_usd, 
  high, 
  low 
FROM 
  pairs p 
  left join last_trades lt on p.ticker_id = lt.ticker_id 
  left join highs h on h.ticker_id = lt.ticker_id 
  left join lows l on l.ticker_id = lt.ticker_id 
  left join dedup_pair_vol pv on pv.ticker_id = p.ticker_id
