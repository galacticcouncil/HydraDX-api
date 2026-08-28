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

function backfillDayKey(date) {
  return date.toISOString().slice(0, 10);
}

// per-day volume + per-pool fees, cached under the backfill key (settled days
// only). shared by the /backfill route and the homepage vol_30d so both read
// the same numbers from the same cache. throws { noDataDay } when the archive
// has no blocks for the day — never a phantom zero.
export async function volumeForDay(redisClient, day) {
  const cacheSetting = CACHE_SETTINGS["defillamaV1Backfill"];
  const key = `${cacheSetting.key}:${day}`;

  const cached = await redisClient.get(key);
  if (cached) return JSON.parse(cached);

  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.getTime() + DAY_MS);
  const result = await volumeForRange(redisClient, start, end);

  if (!result) {
    const error = new Error(`archive has no blocks for ${day}`);
    error.noDataDay = day;
    throw error;
  }

  const totals = {
    volume_usd: result.volumeUsd,
    dailyFees: result.feesUsd,
    fees: {
      xyk: result.feesUsdByPool.XYK,
      stableswap: result.feesUsdByPool.Stableswap,
      omnipool: result.feesUsdByPool.Omnipool,
    },
  };

  // only past days are settled; today's number still moves
  if (end.getTime() <= Date.now()) {
    await redisClient.set(key, JSON.stringify(totals));
    await redisClient.expire(key, cacheSetting.expire_after);
  }
  return totals;
}

// trailing-N-day volume in USD, summed from the same per-day source /backfill
// serves — so the homepage figure matches what DefiLlama reports. excludes
// today (partial); a day the archive can't cover is skipped, not counted zero.
export async function trailingVolumeUsd(redisClient, days = 30) {
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  let total = 0;
  for (let i = 1; i <= days; i++) {
    const day = backfillDayKey(new Date(todayUtc - i * DAY_MS));
    try {
      const totals = await volumeForDay(redisClient, day);
      total += totals.volume_usd;
    } catch (error) {
      if (error.noDataDay) continue;
      throw error;
    }
  }
  return total;
}

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

  const response = [
    {
      volume_usd: result.volumeUsd,
      dailyFees: result.feesUsd,
      fees: {
        xyk: result.feesUsdByPool.XYK,
        stableswap: result.feesUsdByPool.Stableswap,
        omnipool: result.feesUsdByPool.Omnipool,
      },
    },
  ];
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
