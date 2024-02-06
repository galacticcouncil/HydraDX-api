-- getTickers
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
last_price as (
    select
        asset_in, asset_out,
        (amount_in / 10^tm_in.decimals) / (amount_out / 10^tm_out.decimals) as price,
        (amount_out / 10^tm_out.decimals) / (amount_in / 10^tm_in.decimals) as price_reversed
    from router_24h r
    join token_metadata tm_in on r.asset_in = tm_in.id
    join token_metadata tm_out on r.asset_out = tm_out.id
    where rn_from_latest = 1
),
high as (
    select
        asset_in, asset_out,
        (amount_in / 10^tm_in.decimals) / (amount_out / 10^tm_out.decimals) as price,
        (amount_out / 10^tm_out.decimals) / (amount_in / 10^tm_in.decimals) as price_reversed
    from router_24h r
    join token_metadata tm_in on r.asset_in = tm_in.id
    join token_metadata tm_out on r.asset_out = tm_out.id
    where rn_high = 1
),
low as (
    select
        asset_in, asset_out,
        (amount_in / 10^tm_in.decimals) / (amount_out / 10^tm_out.decimals) as price,
        (amount_out / 10^tm_out.decimals) / (amount_in / 10^tm_in.decimals) as price_reversed
    from router_24h r
    join token_metadata tm_in on r.asset_in = tm_in.id
    join token_metadata tm_out on r.asset_out = tm_out.id
    where rn_low = 1
),
real_pairs as (
    select
        tm_in.symbol as base_currency,
        tm_out.symbol as target_currency,
        max(lp.price) as last_price,
        max(lp.price_reversed) as last_price_reversed,
        max(h.price) as high,
        max(l.price_reversed) as high_reversed,
        min(l.price) as low,
        min(h.price_reversed) as low_reversed,
        sum(amount_in / 10^tm_in.decimals) as base_volume,
        sum(amount_out / 10^tm_out.decimals) as target_volume,
        r.asset_in,
        r.asset_out
    from router_24h r
    join token_metadata tm_in on r.asset_in = tm_in.id
    join token_metadata tm_out on r.asset_out = tm_out.id
    join last_price lp on lp.asset_in = tm_in.id and lp.asset_out = tm_out.id
    join high h on h.asset_in = tm_in.id and h.asset_out = tm_out.id
    join low l on l.asset_in = tm_in.id and l.asset_out = tm_out.id
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
        END as target_currency,
        last_price,
        last_price_reversed,
        high,
        high_reversed,
        low,
        low_reversed,
        base_volume,
        target_volume
    from real_pairs
),
dedup as (
    select
        case when base_currency > target_currency then base_currency else target_currency end as base_currency,
        case when base_currency > target_currency then target_currency else base_currency end as target_currency,
        case when base_currency > target_currency then last_price else last_price_reversed end as last_price,
        case when base_currency > target_currency then base_volume else target_volume end as base_volume,
        case when base_currency > target_currency then target_volume else base_volume end as target_volume,
        case when base_currency > target_currency then high else high_reversed end as high,
        case when base_currency > target_currency then low else low_reversed end as low
    from hide_stablepools
)
select
    CONCAT(base_currency, '_', target_currency) as ticker_id,
    base_currency,
    target_currency,
    max(last_price) as last_price,
    sum(base_volume) as base_volume,
    sum(target_volume) as target_volume,
    CONCAT(base_currency, '_', target_currency) as pool_id,
    avg(0) as liquidity_in_usd,
    max(high) as high,
    min(low)as low
from
    dedup
group by
    ticker_id, base_currency, target_currency, pool_id