-- getTickers
WITH relevant_blocks AS (
    SELECT id
    FROM block
    WHERE timestamp > current_timestamp - interval '1 day'
),
swaps_raw AS (
    SELECT
        jsonb_array_elements(args -> 'inputs') AS input,
        jsonb_array_elements(args -> 'outputs') AS output
    FROM event e
    JOIN relevant_blocks b ON e.block_id = b.id
    WHERE e.name = 'Broadcast.Swapped2'
),
parsed AS (
    SELECT
        (input ->> 'asset')::int AS input_asset_id,
        (input ->> 'amount')::numeric AS input_amount,
        (output ->> 'asset')::int AS output_asset_id,
        (output ->> 'amount')::numeric AS output_amount
    FROM swaps_raw
),
with_metadata AS (
    SELECT
        tm_input.symbol AS raw_input_symbol,
        tm_input.decimals AS input_decimals,
        tm_output.symbol AS raw_output_symbol,
        tm_output.decimals AS output_decimals,
        p.input_amount,
        p.output_amount,
        p.input_amount / 10^tm_input.decimals AS input_amount_normalized,
        p.output_amount / 10^tm_output.decimals AS output_amount_normalized
    FROM parsed p
    JOIN token_metadata_test_2 tm_input ON tm_input.id = p.input_asset_id
    JOIN token_metadata_test_2 tm_output ON tm_output.id = p.output_asset_id
),
symbol_adjusted AS (
    SELECT
        CASE raw_input_symbol
            WHEN '2-Pool-Stbl' THEN 'USDC'
            WHEN '4-Pool' THEN 'USDT'
            WHEN 'GDOT-Stbl' THEN 'DOT'
            ELSE raw_input_symbol
        END AS input_symbol_mapped,
        CASE raw_output_symbol
            WHEN '2-Pool-Stbl' THEN 'USDC'
            WHEN '4-Pool' THEN 'USDT'
            WHEN 'GDOT-Stbl' THEN 'DOT'
            ELSE raw_output_symbol
        END AS output_symbol_mapped,
        input_amount,
        output_amount,
        input_amount_normalized,
        output_amount_normalized
    FROM with_metadata
),
no_duplicates AS (
    SELECT
        CASE
            WHEN input_symbol_mapped = output_symbol_mapped AND input_symbol_mapped = 'USDC' THEN 'USDC'
            WHEN input_symbol_mapped = output_symbol_mapped AND input_symbol_mapped = 'USDT' THEN 'USDT'
            ELSE input_symbol_mapped
        END AS input_symbol,
        CASE
            WHEN input_symbol_mapped = output_symbol_mapped AND input_symbol_mapped = 'USDC' THEN 'USDT'
            WHEN input_symbol_mapped = output_symbol_mapped AND input_symbol_mapped = 'USDT' THEN 'USDC'
            ELSE output_symbol_mapped
        END AS output_symbol,
        input_amount,
        output_amount,
        input_amount_normalized,
        output_amount_normalized
    FROM symbol_adjusted
),
canonicalized AS (
    SELECT
        CASE
            WHEN input_symbol = 'H2O' THEN output_symbol
            WHEN output_symbol = 'H2O' THEN input_symbol
            WHEN input_symbol = 'GDOT' THEN input_symbol
            WHEN output_symbol = 'GDOT' THEN output_symbol
            WHEN input_symbol < output_symbol THEN input_symbol
            ELSE output_symbol
        END AS base_currency,
        CASE
            WHEN input_symbol = 'H2O' THEN input_symbol
            WHEN output_symbol = 'H2O' THEN output_symbol
            WHEN input_symbol = 'GDOT' THEN output_symbol
            WHEN output_symbol = 'GDOT' THEN input_symbol
            WHEN input_symbol < output_symbol THEN output_symbol
            ELSE input_symbol
        END AS target_currency,
        CASE
            WHEN input_symbol = 'H2O' THEN output_amount_normalized
            WHEN output_symbol = 'H2O' THEN input_amount_normalized
            WHEN input_symbol = 'GDOT' THEN input_amount_normalized
            WHEN output_symbol = 'GDOT' THEN output_amount_normalized
            WHEN input_symbol < output_symbol THEN input_amount_normalized
            ELSE output_amount_normalized
        END AS base_amount,
        CASE
            WHEN input_symbol = 'H2O' THEN input_amount_normalized
            WHEN output_symbol = 'H2O' THEN output_amount_normalized
            WHEN input_symbol = 'GDOT' THEN output_amount_normalized
            WHEN output_symbol = 'GDOT' THEN input_amount_normalized
            WHEN input_symbol < output_symbol THEN output_amount_normalized
            ELSE input_amount_normalized
        END AS target_amount,
        (CASE
            WHEN input_symbol = 'H2O' THEN output_amount_normalized
            WHEN output_symbol = 'H2O' THEN input_amount_normalized
            WHEN input_symbol = 'GDOT' THEN input_amount_normalized
            WHEN output_symbol = 'GDOT' THEN output_amount_normalized
            WHEN input_symbol < output_symbol THEN input_amount_normalized
            ELSE output_amount_normalized
        END) /
        NULLIF((CASE
            WHEN input_symbol = 'H2O' THEN input_amount_normalized
            WHEN output_symbol = 'H2O' THEN output_amount_normalized
            WHEN input_symbol = 'GDOT' THEN output_amount_normalized
            WHEN output_symbol = 'GDOT' THEN input_amount_normalized
            WHEN input_symbol < output_symbol THEN output_amount_normalized
            ELSE input_amount_normalized
        END), 0) AS price
    FROM no_duplicates
)
SELECT
    base_currency || '_' || target_currency AS ticker_id,
    base_currency,
    target_currency,
    ROUND(AVG(price)::numeric, 12) AS last_price,
    ROUND(SUM(base_amount)::numeric, 12) AS base_volume,
    ROUND(SUM(target_amount)::numeric, 12) AS target_volume,
    base_currency || '_' || target_currency AS pool_id,
    0 AS liquidity_in_usd,
    ROUND(MAX(price)::numeric, 12) AS high,
    ROUND(MIN(price)::numeric, 12) AS low
FROM canonicalized
GROUP BY base_currency, target_currency
ORDER BY ticker_id;