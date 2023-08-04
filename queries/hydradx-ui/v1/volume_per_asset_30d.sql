-- Returns 30 rows with volume in USD, one daily for last 30d, last record is for yesterday

select 
  timestamp::date as date,
  round(sum(volume_roll_24_usd)) as volume_usd
from 
  (
    select 
      row_number() OVER (
        PARTITION BY timestamp :: date, 
        symbol 
        ORDER BY 
          timestamp DESC
      ) AS daily_rn, 
      timestamp,
      symbol,
      volume_roll_24_usd
    from 
      stats_historical
  ) a 
where 
  daily_rn = 1
  and timestamp between now() - interval '30d' and (current_date::timestamp) - interval '1 microsecond'
  and symbol = :assetTicker
group by 1
order by 1