WITH hdx_changes AS (
  SELECT DISTINCT
    block_id,
    '0' AS asset_id,
(args ->> 'amount')::numeric AS amount
  FROM
    event
  WHERE
    name LIKE 'Balances.Transfer'
    AND args ->> 'to' = '0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000'
  UNION ALL SELECT DISTINCT
    block_id,
    '0' AS asset_id,
    -(args ->> 'amount')::numeric AS amount
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
(args ->> 'amount')::numeric AS amount
  FROM
    event
  WHERE
    name = 'Tokens.Transfer'
    AND args ->> 'to' = '0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000'
  UNION ALL
  SELECT
    block_id,
    args ->> 'currencyId' AS asset_id,
    -(args ->> 'amount')::numeric AS amount
  FROM
    event
  WHERE
    name = 'Tokens.Transfer'
    AND args ->> 'from' = '0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000'
  UNION ALL
  SELECT
    block_id,
    args ->> 'currencyId' AS asset_id,
(args ->> 'amount')::numeric AS amount
  FROM
    event
  WHERE
    name = 'Tokens.Deposited'
    AND args ->> 'who' = '0x6d6f646c6f6d6e69706f6f6c0000000000000000000000000000000000000000'
  UNION ALL
  SELECT
    block_id,
    args ->> 'currencyId' AS asset_id,
    -(args ->> 'amount')::numeric AS amount
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
token_reserve AS (
  SELECT
    height,
    timestamp,
    block_id,
    asset_id,
    symbol,
    decimals,
    SUM(amount) OVER (PARTITION BY asset_id ORDER BY block_id) / 10 ^ decimals AS balance,
    SUM(abs(amount)) OVER (PARTITION BY asset_id ORDER BY timestamp RANGE BETWEEN INTERVAL '1 DAY' PRECEDING AND CURRENT ROW) / 10 ^ decimals AS volume
  FROM
    balance_changes
    INNER JOIN block ON block_id = block.id
    INNER JOIN token_metadata ON asset_id = token_metadata.id::text
),
hub_reserve AS (
  SELECT
    asset_id::text AS asset_id,
    block,
    hub_reserve / 10 ^ 12 AS hub_reserve
  FROM
    omnipool_asset
),
a AS (
  SELECT
    timestamp,
    height,
    symbol,
    decimals,
    token_reserve.balance,
    token_reserve.balance / hub_reserve AS hub_price,
    volume
  FROM
    token_reserve
    INNER JOIN hub_reserve ON height = block
      AND token_reserve.asset_id = hub_reserve.asset_id
  WHERE
    symbol = 'DAI'
),
b AS (
  SELECT
    timestamp,
    height,
    symbol,
    tr.asset_id,
    tr.balance,
    decimals,
    hub_reserve / tr.balance AS hub_price,
    volume
  FROM
    token_reserve tr
    INNER JOIN hub_reserve ON height = block
      AND tr.asset_id = hub_reserve.asset_id
  WHERE
    symbol = 'HDX'
),
ldsp AS (
  SELECT DISTINCT
    sp.height,
    sp.timestamp,
    sp.spot_price,
    sp.base_volume,
    sp.target_volume,
    row_number() OVER (PARTITION BY sp.timestamp ORDER BY sp.height DESC) AS rank
FROM (
  SELECT
    a.height,
    a.timestamp::date AS timestamp,
    a.hub_price * b.hub_price AS spot_price,
    a.volume AS base_volume,
    b.volume * a.hub_price * b.hub_price AS target_volume
  FROM
    a
    INNER JOIN b ON a.height = b.height) sp
ORDER BY
  sp.timestamp DESC,
  rank
)
SELECT DISTINCT
  a.timestamp::date AS date,
  CONCAT(a.symbol || '_' || b.symbol) AS ticker_id,
  a.symbol AS base_currency,
  b.symbol AS target_currency,
  ldsp.spot_price AS last_price,
  base_volume,
  target_volume
FROM
  a
  JOIN b ON a.height = b.height
  JOIN ldsp ON a.height = ldsp.height
    AND rank = 1
  ORDER BY
    1
