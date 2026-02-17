import path from "path";
import { fileURLToPath } from "url";

export const IS_DOCKER_RUN = process.env.DOCKER_RUN !== undefined;
export const IS_GOOGLE_CLOUD_RUN = process.env.K_SERVICE !== undefined;
export const IS_GCP_JOB = process.env.GOOGLE_CLOUD_RUN_JOB !== undefined;

export const dirname = () => path.dirname(fileURLToPath(import.meta.url));

export const redisUri = () => {
  if (IS_GOOGLE_CLOUD_RUN || IS_GCP_JOB) {
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
export const orcaSqlPass = () => process.env.PGPASSWORD_DB_ORCA;
export const orcaSqlDatabase = () => "18534_3xqgla";

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
