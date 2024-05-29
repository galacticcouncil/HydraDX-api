-- statsAssetsCount
WITH pools AS (
    SELECT args -> 'assetA' AS asset_1, args -> 'assetB' AS asset_2
    FROM event
    WHERE name = 'XYK.PoolCreated'
),
omnipool_assets AS (
    SELECT asset_id::text
    FROM omnipool_asset
    WHERE block = (SELECT MAX(block) FROM omnipool_asset)
)
SELECT COUNT(*)
FROM event
WHERE name = 'AssetRegistry.Registered'
  AND args -> 'assetType' ->> '__kind' IN ('External', 'Token')
  AND (
      args -> 'assetId' IN (SELECT asset_1 FROM pools)
      OR args -> 'assetId' IN (SELECT asset_2 FROM pools)
      OR args ->> 'assetId' IN (SELECT asset_id FROM omnipool_assets)
  );
