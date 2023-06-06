import fs from "fs";
import { CACHE_SETTINGS } from "../variables.mjs";
import { updateSqlCache } from "../helpers/cache_helpers.mjs";

const TICKERS_QRY = fs
  .readFileSync("./queries/coingecko/tickers.sql")
  .toString();

export const cacheCoingeckoTickersJob = async () => {
  await updateSqlCache(CACHE_SETTINGS["coingeckoTickers"], TICKERS_QRY);

  return true;
};
