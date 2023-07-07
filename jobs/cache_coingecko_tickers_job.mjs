import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../variables.mjs";
import { updateSqlCache } from "../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/coingecko/v1/"), {
  type: "pg",
});

export const cacheCoingeckoTickersJob = async () => {
  await updateSqlCache(
    CACHE_SETTINGS["coingeckoV1Tickers"],
    sqlQueries.getTickers()
  );

  return true;
};
