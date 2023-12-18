-- statsTvl

/* Returns actual TVL */

SELECT 
  asset_id,
  round(sum(oa.hub_reserve/10^12 * leb.last_lrna_price)) as tvl_usd
FROM 
  lrna_every_block leb
  JOIN (
    SELECT 
      LEAST(max_leb.max_height, max_oa.max_block) AS joined_height
    FROM 
      (SELECT MAX(height) as max_height FROM lrna_every_block) max_leb,
      (SELECT MAX(block) as max_block FROM omnipool_asset) max_oa
  ) subq ON leb.height = subq.joined_height
  JOIN omnipool_asset oa ON leb.height = oa.block
  JOIN token_metadata tm ON oa.asset_id = tm.id
WHERE CASE
      WHEN :asset::text IS NOT NULL
        THEN asset_id = :asset
      ELSE
        true
      END
GROUP BY 1