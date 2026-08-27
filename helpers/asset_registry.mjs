import { newRpcClient } from "../clients/rpc.mjs";
import { CACHE_SETTINGS } from "../variables.mjs";

// decimals and asset type straight from the on-chain registry, so nothing here
// has to be kept in a hand-maintained table.
async function readRegistry() {
  const api = await newRpcClient();
  try {
    const entries = await api.query.assetRegistry.assets.entries();
    const meta = {};
    for (const [key, value] of entries) {
      const asset = value.unwrapOr(null);
      if (!asset) continue;
      const json = asset.toJSON();
      const type =
        typeof json.assetType === "string"
          ? json.assetType
          : Object.keys(json.assetType ?? {})[0];
      meta[key.args[0].toString()] = {
        decimals: json.decimals ?? null,
        isPoolShare: type === "StableSwap",
      };
    }
    return meta;
  } finally {
    await api.disconnect();
  }
}

export async function getAssetRegistry(redisClient) {
  const cacheSetting = CACHE_SETTINGS["assetRegistry"];
  const cached = await redisClient.get(cacheSetting.key);
  if (cached) return JSON.parse(cached);

  const meta = await readRegistry();
  await redisClient.set(cacheSetting.key, JSON.stringify(meta));
  await redisClient.expire(cacheSetting.key, cacheSetting.expire_after);
  return meta;
}
