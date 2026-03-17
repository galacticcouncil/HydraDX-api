import { discordWebhookUrl } from "../variables.mjs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEXSCREENER_THRESHOLD = Number(
  process.env.DEXSCREENER_STALE_THRESHOLD_SECONDS ?? 600
);
const ORCA_THRESHOLD = Number(process.env.ORCA_STALE_THRESHOLD_SECONDS ?? 600);

const CHECKS = {
  coingecko_tickers: {
    label: "CoinGecko Tickers",
    url: "https://api.nice.hydration.cloud/coingecko/v1/tickers",
    impact: "CoinGecko",
  },
  hydration_web_stats: {
    label: "Hydration Web Stats",
    url: "https://api.nice.hydration.cloud/hydration-web/v1/stats",
    impact: "hydration.net website",
    minFailures: 3, // cache warm-up can cause transient failures
    mentions: "<@409780457585246216>",
  },
  dexscreener_adapter: {
    label: "DexScreener Adapter",
    url: "https://adapters.kril.hydration.cloud/dexscreener/latest-block",
    impact: "DexScreener",
  },
  orca_indexer: {
    label: "Orca Indexer",
    url: "https://orca-main-aggr-indx.indexer.hydration.cloud/graphql",
    impact: "DefiLlama",
  },
};

const DISCORD_MENTIONS = "<@690220205762543643> <@409780457585246216>";

// ---------------------------------------------------------------------------
// In-memory Prometheus metrics (shared with monitor.mjs HTTP server)
// ---------------------------------------------------------------------------

export const metrics = {
  coingecko_tickers: { up: null, ageSeconds: null, lastCheck: null },
  hydration_web_stats: { up: null, ageSeconds: null, lastCheck: null },
  dexscreener_adapter: { up: null, ageSeconds: null, lastCheck: null },
  orca_indexer: { up: null, ageSeconds: null, lastCheck: null },
};

// ---------------------------------------------------------------------------
// Individual endpoint checks
// ---------------------------------------------------------------------------

async function checkCoingeckoTickers() {
  try {
    const res = await fetch(CHECKS.coingecko_tickers.url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { up: false };
    const data = await res.json();
    const up = Array.isArray(data) && data.length > 0;
    return { up };
  } catch {
    return { up: false };
  }
}

async function checkHydrationWebStats() {
  const isValidStats = (data) =>
    data != null &&
    typeof data.tvl === "number" &&
    data.tvl > 0 &&
    typeof data.vol_30d === "number" &&
    typeof data.xcm_vol_30d === "number";

  const fetchStats = async () => {
    try {
      const res = await fetch(CHECKS.hydration_web_stats.url, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { up: false, data: null };
      const data = await res.json();
      return { up: isValidStats(data), data };
    } catch {
      return { up: false, data: null };
    }
  };

  const first = await fetchStats();
  // If data is already good, return immediately.
  if (first.up) return { up: true };

  // Cold cache: the request above already triggered cache population.
  // Wait 30 s for the stats to load, then do one final check.
  console.log(
    "[monitor] hydration_web_stats: cold cache detected, waiting 30s for warm-up…"
  );
  await new Promise((resolve) => setTimeout(resolve, 30_000));

  const second = await fetchStats();
  return { up: second.up };
}

async function checkDexScreenerAdapter() {
  try {
    const res = await fetch(CHECKS.dexscreener_adapter.url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { up: false };
    const data = await res.json();
    const blockTimestamp = data?.block?.blockTimestamp;
    if (!blockTimestamp) return { up: false };
    const ageSeconds = Math.floor(Date.now() / 1000) - blockTimestamp;
    const up = ageSeconds <= DEXSCREENER_THRESHOLD;
    return { up, ageSeconds };
  } catch {
    return { up: false };
  }
}

async function checkOrcaIndexer() {
  try {
    const res = await fetch(CHECKS.orca_indexer.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query MyQuery { blocks(last: 1) { nodes { height timestamp } } }`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { up: false };
    const data = await res.json();
    const node = data?.data?.blocks?.nodes?.[0];
    if (!node?.timestamp) return { up: false };
    // timestamp is ISO 8601 string
    const blockMs = new Date(node.timestamp).getTime();
    const ageSeconds = Math.floor((Date.now() - blockMs) / 1000);
    const up = ageSeconds <= ORCA_THRESHOLD;
    return { up, ageSeconds };
  } catch {
    return { up: false };
  }
}

// ---------------------------------------------------------------------------
// Discord notification
// ---------------------------------------------------------------------------

async function sendDiscordAlert(checkId, isUp) {
  const webhookUrl = discordWebhookUrl();
  if (!webhookUrl) {
    console.warn("[monitor] DISCORD_WEBHOOK_URL not set – skipping alert");
    return;
  }

  const { label, url, impact } = CHECKS[checkId];
  const link = `[${label}](${url})`;
  const status = isUp ? "**[OK]**" : "**[ERROR]**";
  const verb = isUp
    ? "resumed"
    : checkId === "coingecko_tickers" || checkId === "hydration_web_stats"
    ? "has no data"
    : "stalled (data >10 min old)";

  const mentions = CHECKS[checkId].mentions ?? DISCORD_MENTIONS;
  const content = `:cd: ${status} ${link} ${verb}. Impact: ${impact}. cc ${mentions}`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(
        `[monitor] Discord webhook returned ${res.status} for ${checkId}`
      );
    }
  } catch (err) {
    console.error(`[monitor] Failed to send Discord alert for ${checkId}`, err);
  }
}

// ---------------------------------------------------------------------------
// State machine (Redis-backed)
// ---------------------------------------------------------------------------

function stateKey(checkId) {
  return `monitor:state:${checkId}`;
}

function failuresKey(checkId) {
  return `monitor:failures:${checkId}`;
}

async function handleResult(checkId, result, redisClient) {
  const { up, ageSeconds = null } = result;
  const now = Math.floor(Date.now() / 1000);

  // Update in-memory metrics
  metrics[checkId].up = up;
  metrics[checkId].ageSeconds = ageSeconds;
  metrics[checkId].lastCheck = now;

  const stateK = stateKey(checkId);
  const failK = failuresKey(checkId);
  const previousState = await redisClient.get(stateK);
  const minFailures = CHECKS[checkId].minFailures ?? 1;

  if (up) {
    // Reset failure counter on recovery
    await redisClient.set(failK, "0");
    if (previousState !== "ok") {
      console.log(`[monitor] ${checkId}: ${previousState ?? "unknown"} → ok`);
      await sendDiscordAlert(checkId, true);
      await redisClient.set(stateK, "ok");
    }
  } else {
    const consecutiveFailures =
      Number((await redisClient.get(failK)) ?? "0") + 1;
    await redisClient.set(failK, String(consecutiveFailures));
    console.log(
      `[monitor] ${checkId}: failure ${consecutiveFailures}/${minFailures}`
    );
    if (consecutiveFailures >= minFailures && previousState !== "error") {
      console.log(
        `[monitor] ${checkId}: ${previousState ?? "unknown"} → error`
      );
      await sendDiscordAlert(checkId, false);
      await redisClient.set(stateK, "error");
    }
  }
}

// ---------------------------------------------------------------------------
// Main run function (called every minute by monitor.mjs)
// ---------------------------------------------------------------------------

export async function runMonitorChecks(redisClient) {
  console.log("[monitor] Running checks...");

  const [tickersResult, statsResult, dexResult, orcaResult] =
    await Promise.allSettled([
      checkCoingeckoTickers(),
      checkHydrationWebStats(),
      checkDexScreenerAdapter(),
      checkOrcaIndexer(),
    ]);

  const results = {
    coingecko_tickers: tickersResult,
    hydration_web_stats: statsResult,
    dexscreener_adapter: dexResult,
    orca_indexer: orcaResult,
  };

  for (const [checkId, settled] of Object.entries(results)) {
    if (settled.status === "fulfilled") {
      await handleResult(checkId, settled.value, redisClient);
      const m = metrics[checkId];
      console.log(
        `[monitor] ${checkId}: up=${m.up}${
          m.ageSeconds != null ? ` age=${m.ageSeconds}s` : ""
        }`
      );
    } else {
      console.error(`[monitor] ${checkId} check threw:`, settled.reason);
    }
  }

  console.log("[monitor] Checks complete.");
}
