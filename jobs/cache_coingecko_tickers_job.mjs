import fs from "fs";
import { newRedisClient } from "../clients/redis.mjs";
import { newSqlClient } from "../clients/sql.mjs";
import { CACHE } from "../variables.mjs";

const TICKERS_QRY = fs
  .readFileSync("./queries/coingecko/tickers.sql")
  .toString();

export const cacheCoingeckoTickersJob = async () => {
  let cacheKey = CACHE["coingeckoTickers"].key;
  let cacheExpireAfter = CACHE["coingeckoTickers"].expire_after;

  const sqlClient = await newSqlClient();
  const { rows } = await sqlClient.query(TICKERS_QRY);

  const redis = await newRedisClient();
  await redis.set(cacheKey, JSON.stringify(rows));
  await redis.expire(cacheKey, cacheExpireAfter);

  return true;
};
