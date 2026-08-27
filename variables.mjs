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

// peak observed density is ~1.4 swaps/block, so this leaves ~3x headroom over a
// full chunk. a chunk that reaches it throws rather than silently truncating.
export const firesquidRowLimit = () => 20000;

export const xcmAuthHeader = () =>
  readSecret("xcm_auth_header", "XCM_AUTH_HEADER");

export const discordWebhookUrl = () =>
  readSecret("discord_webhook_url", "DISCORD_WEBHOOK_URL");

export const JOBS = {
  cacheCoingeckoTickersJob: "cache-coingecko-tickers-job",
};

export const CACHE_SETTINGS = {
  coingeckoV1Tickers: {
    key: "coingecko_v1_tickers",
    expire_after: 10 * 60,
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
