import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../variables.mjs";
import { updateCacheFromSql } from "../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/coinmarketcap/v1/"), {
  type: "pg",
});

export async function cacheCoinmarketcapSummaryJob(sqlClient, redisClient) {
  await updateCacheFromSql(
    sqlClient,
    redisClient,
    CACHE_SETTINGS["coinmarketcapV1Summary"],
    sqlQueries.coinmarketcapSummary()
  );

  return true;
}
