import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../variables.mjs";
import { getAssets } from "../helpers/asset_helpers.mjs";
import { updateCache } from "../helpers/cache_helpers.mjs";
import { VALID_TIMEFRAMES } from "../app/routes/hydradx-ui/v1/stats/volume.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/hydradx-ui/v1/stats"), {
  type: "pg",
});

export async function cacheHydradxUiStatsVolumeJob(sqlClient, redisClient) {
  const timeframes = VALID_TIMEFRAMES;
  let assets = await getAssets(sqlClient);
  // Add null at beginning for all assets
  assets.unshift(null);

  for(let a in assets) {
    for(let t in timeframes) {
      await cacheAsset(assets[a], timeframes[t], sqlClient, redisClient);
    }
  }

  return true;
}

async function cacheAsset(asset, timeframe, sqlClient, redisClient) {
  let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV1StatsVolume"] };
  cacheSetting.key = cacheSetting.key + "_" + asset + "_" + timeframe;

  await updateCache(
    sqlClient,
    redisClient,
    cacheSetting,
    sqlQueries.statsVolume({ asset, timeframe })
  );

  return true;
}
