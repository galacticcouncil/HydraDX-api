import { CACHE_SETTINGS } from "../variables.mjs";
import { updateCache } from "../helpers/cache_helpers.mjs";
import { fetchIncumbentTickers } from "../helpers/coingecko_shape.mjs";

export async function cacheCoingeckoTickersJob(redisClient) {
  const cacheSetting = CACHE_SETTINGS["coingeckoV1Tickers"];
  const tickers = await fetchIncumbentTickers();

  // publishing an empty set is what made the 2026-08-25 outage invisible: the
  // query fell to zero rows and the cache faithfully served [] for ~42h.
  if (tickers.length === 0) {
    console.warn("[coingecko] upstream returned 0 tickers, keeping last cache");
    return 0;
  }

  const json = JSON.stringify(tickers);

  await updateCache(redisClient, cacheSetting, json);
  await updateCache(
    redisClient,
    {
      key: cacheSetting.last_good_key,
      expire_after: cacheSetting.last_good_expire_after,
    },
    json
  );

  return tickers.length;
}
