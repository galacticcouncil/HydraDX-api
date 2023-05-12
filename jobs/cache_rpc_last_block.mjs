import { newRedisClient } from "../clients/redis.mjs";
import { newRpcClient } from "../clients/rpc.mjs";

(async () => {
  const rpcClient = await newRpcClient();
  const { block } = await rpcClient.rpc.chain.getBlock();

  const redis = await newRedisClient();
  const payload = JSON.stringify({ block_height: Date() });
  await redis.set("cache_rpc_block_height", payload);

  await redis.disconnect();

  process.exit(1);
})();
