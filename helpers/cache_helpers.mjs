import { newRedisClient } from "../clients/redis.mjs";

export async function cachedFetch(sqlClient, cacheSetting, qry) {
  const redisClient = await newRedisClient();

  let cachedResult = await redisClient.get(cacheSetting.key);

  if (cachedResult == null) {
    cachedResult = await updateCache(sqlClient, redisClient, cacheSetting, qry);
  }

  return cachedResult;
}

export async function updateCache(sqlClient, redisClient, cacheSetting, qry) {
  const { rows } = await sqlClient.query(qry);
  const cachedResult = JSON.stringify(rows);

  await redisClient.set(cacheSetting.key, cachedResult);
  await redisClient.expire(cacheSetting.key, cacheSetting.expire_after);

  return cachedResult;
}
