-- getPairs
with router_24h as (
    select
        cast(args ->> 'assetIn' as integer) as asset_in,
        cast(args ->> 'assetOut' as integer) as asset_out,
        row_number() over (partition by args ->> 'assetIn', args ->> 'assetOut' order by timestamp desc) rn_from_latest,
        row_number() over (partition by args ->> 'assetIn', args ->> 'assetOut'
            order by cast(args ->> 'amountIn' as numeric) / cast(args ->> 'amountOut' as numeric) desc) rn_high,
        row_number() over (partition by args ->> 'assetIn', args ->> 'assetOut'
            order by cast(args ->> 'amountIn' as numeric) / cast(args ->> 'amountOut' as numeric)) rn_low,
        cast(args ->> 'amountIn' as numeric) as amount_in,
        cast(args ->> 'amountOut' as numeric) as amount_out
    from
        event
    join block on event.block_id = block.id
    where
        name = 'Router.RouteExecuted'
        and timestamp > now() - interval '1d'

),
real_pairs as (
    select
        tm_in.symbol as base_currency,
        tm_out.symbol as target_currency,
        r.asset_in,
        r.asset_out
    from router_24h r
    join token_metadata tm_in on r.asset_in = tm_in.id
    join token_metadata tm_out on r.asset_out = tm_out.id
    group by r.asset_in, r.asset_out, tm_in.symbol, tm_out.symbol
),
hide_stablepools as (
    select
        CASE WHEN asset_in = 100 THEN REPLACE(base_currency, '4-Pool', CASE WHEN asset_out = 10 THEN 'USDC' ELSE 'USDT' END)
             WHEN asset_in = 101 THEN REPLACE(base_currency, '2-Pool', CASE WHEN asset_out = 11 THEN 'WBTC' ELSE 'iBTC' END)
             WHEN asset_in = 102 THEN REPLACE(base_currency, '2-Pool-Stbl', CASE WHEN asset_out = 22 THEN 'USDT' ELSE 'USDC' END)
             WHEN asset_out = 100 THEN REPLACE(base_currency, '4-Pool', CASE WHEN asset_in = 10 THEN 'USDC' ELSE 'USDT' END)
             WHEN asset_out = 101 THEN REPLACE(base_currency, '2-Pool', CASE WHEN asset_in = 11 THEN 'WBTC' ELSE 'iBTC' END)
             WHEN asset_out = 102 THEN REPLACE(base_currency, '2-Pool-Stbl', CASE WHEN asset_in = 22 THEN 'USDT' ELSE 'USDC' END)
             ELSE base_currency
        END as base_currency,
        CASE WHEN asset_in = 100 THEN REPLACE(target_currency, '4-Pool', CASE WHEN asset_out = 10 THEN 'USDC' ELSE 'USDT' END)
             WHEN asset_in = 101 THEN REPLACE(target_currency, '2-Pool', CASE WHEN asset_out = 11 THEN 'WBTC' ELSE 'iBTC' END)
             WHEN asset_in = 102 THEN REPLACE(target_currency, '2-Pool-Stbl', CASE WHEN asset_out = 22 THEN 'USDT' ELSE 'USDC' END)
             WHEN asset_out = 100 THEN REPLACE(target_currency, '4-Pool', CASE WHEN asset_in = 10 THEN 'USDC' ELSE 'USDT' END)
             WHEN asset_out = 101 THEN REPLACE(target_currency, '2-Pool', CASE WHEN asset_in = 11 THEN 'WBTC' ELSE 'iBTC' END)
             WHEN asset_out = 102 THEN REPLACE(target_currency, '2-Pool-Stbl', CASE WHEN asset_in = 22 THEN 'USDT' ELSE 'USDC' END)
             ELSE target_currency
        END as target_currency
    from real_pairs
),
dedup as (
    select
        case when base_currency > target_currency then base_currency else target_currency end as base_currency,
        case when base_currency > target_currency then target_currency else base_currency end as target_currency
    from hide_stablepools
)
select
    CONCAT(base_currency, '_', target_currency) as ticker_id,
    base_currency as base,
    target_currency as target
from
    dedup
group by
    ticker_id, base_currency, target_currency