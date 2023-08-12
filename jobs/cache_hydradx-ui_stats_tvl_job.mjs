import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../variables.mjs";
import { updateCache } from "../helpers/cache_helpers.mjs";
import { getAssets } from "../helpers/asset_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/hydradx-ui/v1/stats"), {
  type: "pg",
});

export async function cacheHydradxUiStatsTvlJob(sqlClient, redisClient) {
  let assets = await getAssets(sqlClient);
  // Add null at beginning for all assets
  assets.unshift(null);

  for(let i in assets) {
    console.log(i)
    await cacheTvlForAsset(assets[i], sqlClient, redisClient);
  }

  return true;
}

async function cacheTvlForAsset(asset, sqlClient, redisClient) {
  let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV1StatsTvl"] };
  cacheSetting.key = cacheSetting.key + "_" + asset;

  await updateCache(
    sqlClient,
    redisClient,
    cacheSetting,
    sqlQueries.statsTvl({ asset })
  );

  return true;
}
