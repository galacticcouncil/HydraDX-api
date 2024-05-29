import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../variables.mjs";
import { updateCache } from "../helpers/cache_helpers.mjs";
import { fetchFromSql } from "../helpers/sql_helpers.mjs";

const sqlQueries = yesql(
  path.join(dirname(), "queries/hydration-web/v1/stats"),
  {
    type: "pg",
  }
);

export async function cacheHydrationWebStatsJob(sqlClient, redisClient) {
  let cacheSetting = { ...CACHE_SETTINGS["hydrationWebV1Stats"] };

  let result = {};

  // tvl
  const tvlQuery = await fetchFromSql(
    sqlClient,
    sqlQueries.statsTvl({ asset: null })
  );
  const tvl = tvlQuery.map((x) => x["tvl_usd"]).reduce((sum, x) => sum + x);
  result["tvl"] = tvl;

  // vol_30d
  const vol_30dQuery = await fetchFromSql(sqlClient, sqlQueries.statsVol30d());
  const vol_30d = vol_30dQuery[0]["volume_usd"];
  result["vol_30d"] = vol_30d;

  // xcm_vol_30d
  const xcm_vol_30d = JSON.parse(vol_30d) / 2;
  result["xcm_vol_30d"] = xcm_vol_30d;

  // assets_count
  const assetsCount = await fetchFromSql(
    sqlClient,
    sqlQueries.statsAssetsCount()
  );
  result["assets_count"] = assetsCount[0]["count"];

  // accounts_count
  const accountsCount = await fetchFromSql(
    sqlClient,
    sqlQueries.statsAccountsCount()
  );
  result["accounts_count"] = accountsCount[0]["count"];

  await updateCache(redisClient, cacheSetting, JSON.stringify(result));

  return true;
}
