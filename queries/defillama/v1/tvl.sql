-- defillamaTvl

/* Returns actual TVL */

SELECT 
  round(sum(oa.hub_reserve/10^12 * leb.last_lrna_price)) as tvl_usd
FROM 
  lrna_every_block leb
  JOIN (
    SELECT MAX(height) as max_height
    FROM lrna_every_block
  ) max_leb ON leb.height = max_leb.max_height
  JOIN omnipool_asset oa ON leb.height = oa.block
  JOIN token_metadata tm ON oa.asset_id = tm.id
WHERE CASE
      WHEN :asset::text IS NOT NULL
        THEN symbol = :asset
      ELSE
        true
      END
