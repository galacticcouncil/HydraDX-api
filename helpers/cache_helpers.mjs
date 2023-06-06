import { newRedisClient } from "../clients/redis.mjs";
import { newSqlClient } from "../clients/sql.mjs";

export async function readSqlCacheOrUpdate(
  cacheSetting,
  qry,
  redisClient = null,
  sqlClient = null
) {
  if (sqlClient == null) {
    sqlClient = await newSqlClient();
  }
  if (redisClient == null) {
    redisClient = await newRedisClient();
  }

  let cachedResult = await redisClient.get(cacheSetting.key);

  if (cachedResult == null) {
    cachedResult = updateSqlCache(cacheSetting, qry, redisClient, sqlClient);
  }

  return cachedResult;
}

export async function updateSqlCache(
  cacheSetting,
  qry,
  redisClient = null,
  sqlClient = null
) {
  if (sqlClient == null) {
    console.log("iz null");
    sqlClient = await newSqlClient();
  }
  if (redisClient == null) {
    redisClient = await newRedisClient();
  }

  const { rows } = await sqlClient.query(qry);
  const cachedResult = JSON.stringify(rows);

  await redisClient.set(cacheSetting.key, cachedResult);
  await redisClient.expire(cacheSetting.key, cacheSetting.expire_after);

  return cachedResult;
}
