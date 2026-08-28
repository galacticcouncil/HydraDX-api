import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

export const IS_DOCKER_RUN = process.env.DOCKER_RUN !== undefined;

// Read from Docker secret file if present, fall back to env var
const readSecret = (secretName, envVar) => {
  try {
    return fs.readFileSync(`/run/secrets/${secretName}`, "utf8").trim();
  } catch {
    return process.env[envVar];
  }
};

export const dirname = () => path.dirname(fileURLToPath(import.meta.url));

export const redisUri = () => process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

export const rpcUri = () => "wss://rpc.hydradx.cloud";

export const neckworkBaseUrl = () =>
  process.env.NECKWORK_API_URL ?? "https://hydration-api.neckwork.net";

// the incumbent tickers query hardcoded liquidity_in_usd to 0. neckwork
// publishes real depth; "real" passes it through, anything else keeps parity.
export const coingeckoLiquiditySource = () =>
  process.env.COINGECKO_LIQUIDITY === "real" ? "real" : "incumbent";

// Primary database configuration
export const primarySqlHost = () => "91.98.180.149";
export const primarySqlPort = () => 16201;
export const primarySqlUser = () => "read_only_postgres";
export const primarySqlPass = () =>
  readSecret("pgpassword_db", "PGPASSWORD_DB");
export const primarySqlDatabase = () => "aggregator_indexer";

// Fallback database configuration
export const fallbackSqlHost = () => "135.181.128.254";
export const fallbackSqlPort = () => 16201;
export const fallbackSqlUser = () => "read_only_postgres";
export const fallbackSqlPass = () =>
  readSecret("pgpassword_db_fallback", "PGPASSWORD_DB_FALLBACK");
export const fallbackSqlDatabase = () => "aggregator_indexer";

// firesquid archives: raw block/event mirrors of the chain, fed straight off an
// rpc. independent hosts, tried in order.
export const firesquidEndpoints = () => [
  "https://hydradx-explorer.play.hydration.cloud/graphql",
  "https://hydradx-explorer.shellfish.hydration.cloud/graphql",
];

// blocks per archive query. the archive is round-trip bound rather than scan
// bound over a height range, so bigger chunks are much faster; the ceiling is
// firesquidRowLimit, which a chunk must never reach.
export const firesquidChunkBlocks = () => 5000;

// earliest day this endpoint will answer for. two hard limits sit behind it:
// the archive carries no `Broadcast.Swapped3` before 2025-05-21 (swaps were
// emitted under the older event shape, so a sweep finds nothing and would
// report a real-looking 0), and through 2026-01 the derived figures disagree
// with the incumbent series by up to 40% — the price graph is reconstructed
// from the swaps themselves and is thin that far back. Measured 2026-08-28
// against DefiLlama's own stored series: 2026-01-01 ratio 1.176, 2026-02-01
// 1.002, 2026-02-15 0.997. Serving the earlier era would silently overwrite
// a consumer's correct history with worse numbers, so refuse it instead.
export const defillamaTrustedFrom = () =>
  process.env.DEFILLAMA_TRUSTED_FROM ?? "2026-02-01";

// peak observed density is ~1.4 swaps/block, so this leaves ~3x headroom over a
// full chunk. a chunk that reaches it throws rather than silently truncating.
export const firesquidRowLimit = () => 20000;

export const xcmAuthHeader = () =>
  readSecret("xcm_auth_header", "XCM_AUTH_HEADER");

export const discordWebhookUrl = () =>
  readSecret("discord_webhook_url", "DISCORD_WEBHOOK_URL");

export const JOBS = {
  cacheCoingeckoTickersJob: "cache-coingecko-tickers-job",
  cacheDefillamaVolumeJob: "cache-defillama-volume-job",
};

export const CACHE_SETTINGS = {
  coingeckoV1Tickers: {
    key: "coingecko_v1_tickers",
    expire_after: 10 * 60,
    // survives an upstream outage: a stale ticker set beats an empty one,
    // which is exactly how the 2026-08-25 outage served [] for ~42h.
    last_good_key: "coingecko_v1_tickers_last_good",
    last_good_expire_after: 24 * 60 * 60,
  },
  hydrationWebV1Stats: {
    key: "hydration-web_v1_stats",
    expire_after: 10 * 60,
  },
  lendingV1Caps: {
    key: "lending_v1_caps",
    expire_after: 60,
  },
  defillamaV1Volume: {
    key: "defillama_v1_volume",
    expire_after: 10 * 60,
    // survives an archive outage: a stale figure beats a made-up zero
    last_good_key: "defillama_v1_volume_last_good",
    last_good_expire_after: 24 * 60 * 60,
  },
  // per-day results keyed by date. past days never change, so they are kept
  // long enough that a backfill sweep only pays for each day once.
  defillamaV1Backfill: {
    key: "defillama_v1_backfill_day",
    expire_after: 30 * 24 * 60 * 60,
  },
  assetRegistry: {
    key: "asset_registry",
    expire_after: 6 * 60 * 60,
  },
};
