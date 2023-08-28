import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../variables.mjs";
import { updateCache } from "../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/coinmarketcap/v1/"), {
  type: "pg",
});

export async function cacheCoinmarketcapSummaryJob(sqlClient, redisClient) {
  await updateCache(
    sqlClient,
    redisClient,
    CACHE_SETTINGS["coinmarketcapV1Summary"],
    sqlQueries.coinmarketcapSummary()
  );

  return true;
}
