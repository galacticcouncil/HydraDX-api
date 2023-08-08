-- Returns 30 rows with volume in USD, one daily for last 30d, last record is for yesterday

select 
  timestamp::date as date,
  round(sum(volume_usd)/2) as volume_usd
from 
  stats_historical
where 
  timestamp between now() - interval '30d' and (current_date::timestamp) - interval '1 microsecond'
  and symbol = :assetTicker
group by 1
order by 1