import { refreshVolume24h } from "../helpers/defillama_source.mjs";

// a cold 24h sweep of the archive takes ~15s, which is long enough for a
// partner's http client to give up. keeping the cache warm means DefiLlama
// only ever reads a value that was already computed.
export async function cacheDefillamaVolumeJob(redisClient) {
  const response = await refreshVolume24h(redisClient);

  if (!response) {
    console.warn("[defillama] archive returned no blocks, keeping last cache");
    return null;
  }

  return response[0].volume_usd;
}
