import { CACHE_SETTINGS } from "../variables.mjs";
import {
  fetchSwapEvents,
  firstBlockAtOrAfter,
  latestBlock,
} from "../clients/firesquid.mjs";
import { getAssetRegistry } from "./asset_registry.mjs";
import {
  aggregateByDay,
  parseSwapEvents,
  totalsOf,
} from "./defillama_volume.mjs";

// resolves a [start, end) instant range onto archive block heights. end is
// exclusive; a null end means "up to the archive head".
async function heightRange(start, end) {
  const head = await latestBlock();
  const first = await firstBlockAtOrAfter(start);
  if (!first) return null;

  let toHeight = head.height + 1;
  if (end != null && end < head.timestamp) {
    const last = await firstBlockAtOrAfter(end);
    if (last) toHeight = last.height;
  }
  if (toHeight <= first.height) return null;

  return { fromHeight: first.height, toHeight, head };
}

async function collectFills(fromHeight, toHeight, registry) {
  const fills = [];
  await fetchSwapEvents(fromHeight, toHeight, (events) => {
    for (const fill of parseSwapEvents(events, registry)) fills.push(fill);
  });
  return fills;
}

export async function volumeForRange(redisClient, start, end) {
  const registry = await getAssetRegistry(redisClient);
  const range = await heightRange(start, end);
  if (!range) return null;

  const fills = await collectFills(range.fromHeight, range.toHeight, registry);
  const byDay = aggregateByDay(fills);
  return {
    ...totalsOf(byDay),
    byDay,
    fills: fills.length,
    head: range.head,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// computes the rolling 24h figure and writes both cache slots. shared by the
// route and the warm job so a cold sweep is never paid on a request path.
// returns null when the archive has no blocks for the window — never a zero.
export async function refreshVolume24h(redisClient) {
  const cacheSetting = CACHE_SETTINGS["defillamaV1Volume"];
  const result = await volumeForRange(
    redisClient,
    new Date(Date.now() - DAY_MS),
    null
  );
  if (!result) return null;

  const response = [{ volume_usd: result.volumeUsd }];
  const json = JSON.stringify(response);

  await redisClient.set(cacheSetting.key, json);
  await redisClient.expire(cacheSetting.key, cacheSetting.expire_after);
  await redisClient.set(cacheSetting.last_good_key, json);
  await redisClient.expire(
    cacheSetting.last_good_key,
    cacheSetting.last_good_expire_after
  );

  return response;
}
