export async function cachedFetch(sqlClient, redisClient, cacheSetting, qry) {
  let cachedResult = await redisClient.get(cacheSetting.key);

  if (cachedResult == null) {
    cachedResult = await updateCacheFromSql(sqlClient, redisClient, cacheSetting, qry);
  }

  return cachedResult;
}

export async function updateCacheFromSql(sqlClient, redisClient, cacheSetting, qry) {
  const { rows } = await sqlClient.query(qry);
  const cachedResult = JSON.stringify(rows);

  await redisClient.set(cacheSetting.key, cachedResult);
  await redisClient.expire(cacheSetting.key, cacheSetting.expire_after);

  return cachedResult;
}
