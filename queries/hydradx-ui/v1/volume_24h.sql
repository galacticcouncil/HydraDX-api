-- Returns 24 rows with volume in USD, one hourly for last 24 hours, last record is for last hour

select 
  date_trunc('hour', timestamp) as hour,
  round(sum(volume_usd)/2) as volume_usd
from 
  stats_historical
where timestamp between now() - interval '24h' and date_trunc('hour', now()) - interval '1 microsecond'
group by 1
order by 1