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

export const sqlHost = () => {
  if (IS_GOOGLE_CLOUD_RUN || IS_GCP_JOB) {
    return "10.130.49.4";
  } else {
    return "127.0.0.1";
  }
};

// TODO: move to env
export const sqlPort = () => 5432;
export const sqlUser = () => "squid";
export const sqlPass = () => "squid";
export const sqlDatabase = () => "squid";

export const JOBS = {
  cacheRpcBlockHeightJob: "cache-rpc-block-height-job",
  cacheCoingeckoTickersJob: "cache-coingecko-tickers-job",
};

export const CACHE_SETTINGS = {
  coingeckoV1Pairs: {
    key: "coingecko_v1_pairs",
    expire_after: 3600,
  },
  coingeckoV1Tickers: {
    key: "coingecko_v1_tickers",
    expire_after: 700,
  },
  hydradxUiV1stats: {
    key: "hydradx-ui_v1_stats",
    expire_after: 60,
  },
};
