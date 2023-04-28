const {newRedisClient} = require('../clients/redis');

(async () => {
  const redis = await newRedisClient();

  // redis.set("cache_rpc_block_height", )

  redis.disconnect()
})();
