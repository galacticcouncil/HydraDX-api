-- getTickers
WITH token_metadata (id, symbol, decimals) AS (
    VALUES
    (1000081, 'PEN',       12),
    (34,      'ETH',       18),
    (1000125, 'PXPS',      10),
    (1000131, 'CATWIF',    10),
    (1000142, 'GOVD',      10),
    (1000144, 'STEEBOR',   20),
    (1000148, 'BORK',      10),
    (1000151, 'PEPE',      10),
    (1000153, 'KRAK',      10),
    (1000155, 'DOGE',      10),
    (1000159, 'HYDRA',     10),
    (1000163, 'DOTTY',     10),
    (1000167, 'CLAY',      10),
    (1000177, 'BUNS',      10),
    (1000193, 'StabCP',    10),
    (420,     'GETH',      18),
    (1000199, 'KOL',       12),
    (1000203, 'MeTest',    12),
    (1000209, 'PBTC',      10),
    (1000211, 'SOLETH',    10),
    (1000217, 'TeMe6',     12),
    (1000222, 'NOTDED',    10),
    (690,     'GDOT-Stbl', 18),
    (69,      'GDOT',      18),
    (4200,    'GETH-Stbl', 18),
    (35,      'TRAC',      18),
    (36,      'NEURO',     12),
    (222,     'HOLLAR',    18),
    (1110,    'HUSDC',     18),
    (1111,    'HUSDT',     18),
    (1112,    'HUSDS',     18),
    (1113,    'HUSDe',     18),
    (1000625, 'sUSDe',     18),
    (1002,    'aUSDT',      6),
    (1003,    'aUSDC',      6),
    (1000019, 'DED',       10),
    (1000021, 'PINK',      10),
    (0,       'HDX',       12),
    (1,       'H2O',       12),
    (2,       'DAI',       18),
    (3,       'WBTC',       8),
    (4,       'WETH',      18),
    (5,       'DOT',       10),
    (6,       'APE',       18),
    (7,       'USDC',       6),
    (8,       'PHA',       12),
    (9,       'ASTR',      18),
    (10,      'USDT',       6),
    (11,      'iBTC',       8),
    (12,      'ZTG',       10),
    (13,      'CFG',       18),
    (14,      'BNC',       12),
    (15,      'vDOT',      10),
    (16,      'GLMR',      18),
    (17,      'INTR',      10),
    (18,      'DAI',       18),
    (19,      'WBTC',       8),
    (20,      'WETH',      18),
    (21,      'USDC',       6),
    (22,      'USDC',       6),
    (23,      'USDT',       6),
    (24,      'SUB',       10),
    (25,      'UNQ',       18),
    (26,      'NODL',      11),
    (27,      'CRU',       12),
    (28,      'KILT',      15),
    (30,      'MYTH',      18),
    (31,      'RING',      18),
    (32,      'AJUN',      12),
    (33,      'vASTR',     18),
    (252525,  'EWT',       18),
    (1000085, 'WUD',       10),
    (1000197, 'NCTR',      18),
    (1000624, 'AAVE',      18),
    (1000752, 'SOL',        9),
    (1000765, 'tBTC',      18),
    (1000771, 'KSM',       12),
    (1000794, 'LINK',      18),
    (1000795, 'SKY',       18),
    (1000034, 'STINK',     10),
    (1000036, 'BEEFY',      2),
    (1000038, 'DOTA',       4),
    (1000054, 'LEEMO',     10),
    (1000059, 'ASX',       10),
    (1000060, 'PJS',       18),
    (1000062, 'GABE',      20),
    (1000073, 'GBILL',      8),
    (1000078, 'CHAOS',     10),
    (1000080, 'BOOTY',     10),
    (1000082, 'WIFD',      10),
    (1000091, 'BNDT',      10),
    (1000104, 'GAME',      10),
    (1000106, 'TOM',       10),
    (1000124, 'JAM',       10),
    (43,      'PRIME',      6),
    (39,      'PAXG',      18),
    (38,      'ENA',       18),
    (40,      'jitoSOL',    9),
    (41,      'CFG',       18),
    (42,      'EURC',       6),
    (1044,    'EURC',       6)
),
relevant_blocks AS (
    SELECT id
    FROM block
    WHERE timestamp > current_timestamp - interval '1 day'
),
swaps_raw AS (
    SELECT
        e.block_id,
        e.index_in_block,
        jsonb_array_elements(e.args::jsonb -> 'inputs') AS input,
        jsonb_array_elements(e.args::jsonb -> 'outputs') AS output
    FROM event e
    JOIN relevant_blocks b ON e.block_id = b.id
    WHERE e.name = 'Broadcast.Swapped3'
),
parsed AS (
    SELECT
        sr.block_id,
        sr.index_in_block,
        (input ->> 'asset')::int AS input_asset_id,
        (input ->> 'amount')::numeric AS input_amount,
        (output ->> 'asset')::int AS output_asset_id,
        (output ->> 'amount')::numeric AS output_amount
    FROM swaps_raw sr
),
with_metadata AS (
    SELECT
        p.block_id,
        p.index_in_block,
        p.input_amount,
        p.output_amount,
        CASE tm_input.symbol
            WHEN 'GDOT-Stbl' THEN 'DOT'
            WHEN 'GETH-Stbl' THEN 'ETH'
            WHEN 'aUSDT' THEN 'USDT'
            WHEN 'aUSDC' THEN 'USDC'
            ELSE tm_input.symbol
        END AS input_symbol,
        CASE tm_output.symbol
            WHEN 'GDOT-Stbl' THEN 'DOT'
            WHEN 'GETH-Stbl' THEN 'ETH'
            WHEN 'aUSDT' THEN 'USDT'
            WHEN 'aUSDC' THEN 'USDC'
            ELSE tm_output.symbol
        END AS output_symbol,
        p.input_amount / 10^tm_input.decimals AS input_amount_normalized,
        p.output_amount / 10^tm_output.decimals AS output_amount_normalized
    FROM parsed p
    JOIN token_metadata tm_input ON tm_input.id = p.input_asset_id
    JOIN token_metadata tm_output ON tm_output.id = p.output_asset_id
),
normalized_pairs AS (
    SELECT
        block_id,
        index_in_block,
        CASE
            WHEN input_symbol = output_symbol AND input_symbol = 'USDC' THEN 'USDC'
            WHEN input_symbol = output_symbol AND input_symbol = 'USDT' THEN 'USDT'
            ELSE input_symbol
        END AS input_symbol,
        CASE
            WHEN input_symbol = output_symbol AND input_symbol = 'USDC' THEN 'USDT'
            WHEN input_symbol = output_symbol AND input_symbol = 'USDT' THEN 'USDC'
            ELSE output_symbol
        END AS output_symbol,
        input_amount_normalized,
        output_amount_normalized
    FROM with_metadata
),
canonicalized AS (
    SELECT
        block_id,
        index_in_block,
        CASE
            WHEN input_symbol = 'H2O' THEN output_symbol
            WHEN output_symbol = 'H2O' THEN input_symbol
            WHEN input_symbol = 'GDOT' THEN output_symbol
            WHEN output_symbol = 'GDOT' THEN input_symbol
            WHEN input_symbol = 'GETH' THEN output_symbol
            WHEN output_symbol = 'GETH' THEN input_symbol
            WHEN input_symbol < output_symbol THEN input_symbol
            ELSE output_symbol
        END AS base_currency,

        CASE
            WHEN input_symbol = 'H2O' THEN input_symbol
            WHEN output_symbol = 'H2O' THEN output_symbol
            WHEN input_symbol = 'GDOT' THEN input_symbol
            WHEN output_symbol = 'GDOT' THEN output_symbol
            WHEN input_symbol = 'GETH' THEN input_symbol
            WHEN output_symbol = 'GETH' THEN output_symbol
            WHEN input_symbol < output_symbol THEN output_symbol
            ELSE input_symbol
        END AS target_currency,

        CASE
            WHEN input_symbol = 'H2O' THEN output_amount_normalized
            WHEN output_symbol = 'H2O' THEN input_amount_normalized
            WHEN input_symbol = 'GDOT' THEN output_amount_normalized
            WHEN output_symbol = 'GDOT' THEN input_amount_normalized
            WHEN input_symbol = 'GETH' THEN output_amount_normalized
            WHEN output_symbol = 'GETH' THEN input_amount_normalized
            WHEN input_symbol < output_symbol THEN input_amount_normalized
            ELSE output_amount_normalized
        END AS base_amount,

        CASE
            WHEN input_symbol = 'H2O' THEN input_amount_normalized
            WHEN output_symbol = 'H2O' THEN output_amount_normalized
            WHEN input_symbol = 'GDOT' THEN input_amount_normalized
            WHEN output_symbol = 'GDOT' THEN output_amount_normalized
            WHEN input_symbol = 'GETH' THEN input_amount_normalized
            WHEN output_symbol = 'GETH' THEN output_amount_normalized
            WHEN input_symbol < output_symbol THEN output_amount_normalized
            ELSE input_amount_normalized
        END AS target_amount,

        (CASE
            WHEN input_symbol = 'H2O' THEN output_amount_normalized
            WHEN output_symbol = 'H2O' THEN input_amount_normalized
            WHEN input_symbol = 'GDOT' THEN output_amount_normalized
            WHEN output_symbol = 'GDOT' THEN input_amount_normalized
            WHEN input_symbol = 'GETH' THEN output_amount_normalized
            WHEN output_symbol = 'GETH' THEN input_amount_normalized
            WHEN input_symbol < output_symbol THEN input_amount_normalized
            ELSE output_amount_normalized
        END) /
        NULLIF((CASE
            WHEN input_symbol = 'H2O' THEN input_amount_normalized
            WHEN output_symbol = 'H2O' THEN output_amount_normalized
            WHEN input_symbol = 'GDOT' THEN input_amount_normalized
            WHEN output_symbol = 'GDOT' THEN output_amount_normalized
            WHEN input_symbol = 'GETH' THEN input_amount_normalized
            WHEN output_symbol = 'GETH' THEN output_amount_normalized
            WHEN input_symbol < output_symbol THEN output_amount_normalized
            ELSE input_amount_normalized
        END), 0) AS price
    FROM normalized_pairs
),
ohl_summary AS (
    SELECT
        base_currency,
        target_currency,
        MAX(price) AS high,
        MIN(price) AS low
    FROM canonicalized
    GROUP BY base_currency, target_currency
),
volume_summary AS (
    SELECT
        base_currency,
        target_currency,
        SUM(base_amount) AS base_volume,
        SUM(target_amount) AS target_volume
    FROM canonicalized
    GROUP BY base_currency, target_currency
),
ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY base_currency, target_currency
               ORDER BY block_id DESC, index_in_block DESC
           ) AS rn
    FROM canonicalized
)
SELECT
    r.base_currency || '_' || r.target_currency AS ticker_id,
    r.base_currency,
    r.target_currency,
    ROUND(r.price::numeric, 12) AS last_price,
    ROUND(v.base_volume::numeric, 12) AS base_volume,
    ROUND(v.target_volume::numeric, 12) AS target_volume,
    r.base_currency || '_' || r.target_currency AS pool_id,
    0 AS liquidity_in_usd,
    ROUND(o.high::numeric, 12) AS high,
    ROUND(o.low::numeric, 12) AS low
FROM ranked r
JOIN ohl_summary o
  ON r.base_currency = o.base_currency AND r.target_currency = o.target_currency
JOIN volume_summary v
  ON r.base_currency = v.base_currency AND r.target_currency = v.target_currency
WHERE r.rn = 1
ORDER BY ticker_id
