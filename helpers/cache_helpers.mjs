export async function fetchFromCache(redisClient, cacheSetting) {
  let cachedResult = await redisClient.get(cacheSetting.key);
  return cachedResult;
}

export async function updateCache(redisClient, cacheSetting, json) {
  await redisClient.set(cacheSetting.key, json);
  await redisClient.expire(cacheSetting.key, cacheSetting.expire_after);

  return json
}

export async function cachedFetch(sqlClient, redisClient, cacheSetting, qry) {
  let cachedResult = await fetchFromCache(redisClient, cacheSetting)

  if (cachedResult == null) {
    cachedResult = await updateCacheFromSql(sqlClient, redisClient, cacheSetting, qry);
  }

  return cachedResult;
}

export async function updateCacheFromSql(sqlClient, redisClient, cacheSetting, qry) {
  const { rows } = await sqlClient.query(qry);
  const result = JSON.stringify(rows);

  await updateCache(redisClient, cacheSetting, result)

  return result;
}
