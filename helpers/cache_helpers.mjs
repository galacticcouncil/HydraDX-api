import { newRedisClient } from "../clients/redis.mjs";
import { newSqlClient } from "../clients/sql.mjs";

export async function readSqlCacheOrUpdate(
  cacheSetting,
  qry,
) {
  const redisClient = await newRedisClient();

  let cachedResult = await redisClient.get(cacheSetting.key);

  if (cachedResult == null) {
    cachedResult = updateSqlCache(cacheSetting, qry, redisClient);
  }

  return cachedResult;
}

export async function updateSqlCache(
  cacheSetting,
  qry,
  redisClient = null
) {
  if (redisClient == null) {
    redisClient = await newRedisClient();
  }

  const sqlClient = await newSqlClient();
  
  const { rows } = await sqlClient.query(qry);
  const cachedResult = JSON.stringify(rows);

  await redisClient.set(cacheSetting.key, cachedResult);
  await redisClient.expire(cacheSetting.key, cacheSetting.expire_after);
  sqlClient.release();

  return cachedResult;
}
