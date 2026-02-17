import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../variables.mjs";
import { updateCacheFromSql } from "../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/coingecko/v1/"), {
  type: "pg",
});

export async function cacheCoingeckoTickersJob(sqlClient, redisClient) {
  await updateCacheFromSql(
    sqlClient,
    redisClient,
    CACHE_SETTINGS["coingeckoV1Tickers"],
    sqlQueries.getTickers()
  );
}
