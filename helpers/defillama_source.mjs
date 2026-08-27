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
