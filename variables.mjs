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
export const IS_GOOGLE_CLOUD_RUN = process.env.K_SERVICE !== undefined;
export const IS_GCP_JOB = process.env.GOOGLE_CLOUD_RUN_JOB !== undefined;

export const dirname = () => path.dirname(fileURLToPath(import.meta.url));

export const redisUri = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  } else if (IS_GOOGLE_CLOUD_RUN || IS_GCP_JOB) {
    return "redis://10.130.48.5:6379";
  } else {
    return "redis://127.0.0.1:6379";
  }
};

export const rpcUri = () => "wss://rpc.hydradx.cloud";

// Orca database configuration (Subsquid)
export const orcaSqlHost = () => "pg.squid.subsquid.io";
export const orcaSqlPort = () => 5432;
export const orcaSqlUser = () => "18534_3xqgla";
export const orcaSqlPass = () =>
  readSecret("pgpassword_db_orca", "PGPASSWORD_DB_ORCA");
export const orcaSqlDatabase = () => "18534_3xqgla";

// Fallback database configuration (shared credentials, two hosts)
export const fallbackSqlHosts = () => ["91.98.180.149", "135.181.128.254"];
export const fallbackSqlPort = () => 16201;
export const fallbackSqlUser = () => "read_only_postgres";
export const fallbackSqlPass = () =>
  readSecret("pgpassword_db_fallback", "PGPASSWORD_DB_FALLBACK");
export const fallbackSqlDatabase = () => "aggregator_indexer";

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
};
