-- getTickers
WITH relevant_blocks AS (
    SELECT id
    FROM block
    WHERE timestamp > current_timestamp - interval '1 day'
),
swaps_raw AS (
    SELECT
        e.block_id,
        e.index_in_block,
        jsonb_array_elements(e.args -> 'inputs') AS input,
        jsonb_array_elements(e.args -> 'outputs') AS output
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
            WHEN '2-Pool-Stbl' THEN 'USDC'
            WHEN '4-Pool' THEN 'USDT'
            WHEN 'GDOT-Stbl' THEN 'DOT'
            ELSE tm_input.symbol
        END AS input_symbol,
        CASE tm_output.symbol
            WHEN '2-Pool-Stbl' THEN 'USDC'
            WHEN '4-Pool' THEN 'USDT'
            WHEN 'GDOT-Stbl' THEN 'DOT'
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
            WHEN input_symbol < output_symbol THEN input_symbol
            ELSE output_symbol
        END AS base_currency,

        CASE
            WHEN input_symbol = 'H2O' THEN input_symbol
            WHEN output_symbol = 'H2O' THEN output_symbol
            WHEN input_symbol = 'GDOT' THEN input_symbol
            WHEN output_symbol = 'GDOT' THEN output_symbol
            WHEN input_symbol < output_symbol THEN output_symbol
            ELSE input_symbol
        END AS target_currency,

        CASE
            WHEN input_symbol = 'H2O' THEN output_amount_normalized
            WHEN output_symbol = 'H2O' THEN input_amount_normalized
            WHEN input_symbol = 'GDOT' THEN output_amount_normalized
            WHEN output_symbol = 'GDOT' THEN input_amount_normalized
            WHEN input_symbol < output_symbol THEN input_amount_normalized
            ELSE output_amount_normalized
        END AS base_amount,

        CASE
            WHEN input_symbol = 'H2O' THEN input_amount_normalized
            WHEN output_symbol = 'H2O' THEN output_amount_normalized
            WHEN input_symbol = 'GDOT' THEN input_amount_normalized
            WHEN output_symbol = 'GDOT' THEN output_amount_normalized
            WHEN input_symbol < output_symbol THEN output_amount_normalized
            ELSE input_amount_normalized
        END AS target_amount,

        (CASE
            WHEN input_symbol = 'H2O' THEN output_amount_normalized
            WHEN output_symbol = 'H2O' THEN input_amount_normalized
            WHEN input_symbol = 'GDOT' THEN output_amount_normalized
            WHEN output_symbol = 'GDOT' THEN input_amount_normalized
            WHEN input_symbol < output_symbol THEN input_amount_normalized
            ELSE output_amount_normalized
        END) /
        NULLIF((CASE
            WHEN input_symbol = 'H2O' THEN input_amount_normalized
            WHEN output_symbol = 'H2O' THEN output_amount_normalized
            WHEN input_symbol = 'GDOT' THEN input_amount_normalized
            WHEN output_symbol = 'GDOT' THEN output_amount_normalized
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