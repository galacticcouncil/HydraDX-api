import path from "path";
import { fileURLToPath } from "url";
import {cacheHydradxUiV2StatsVolumeJob} from "./jobs/cache_hydradx-ui_v2_stats_volume_job.mjs";

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
  cacheCoingeckoTickersJob: "cache-coingecko-tickers-job",
  cacheHydrationWebStatsJob: "cache-hydration-web-stats-job",
  cacheHydradxUiStatsTvlJob: "cache-hydradx-ui-stats-tvl-job",
  cacheHydradxUiV2StatsVolumeJob: "cache-hydradx-ui-v2-stats-volume-job",
  cacheCoinmarketcapSummaryJob: "cache-coinmarketcap-summary-job",
};

export const CACHE_SETTINGS = {
  coingeckoV1Pairs: {
    key: "coingecko_v1_pairs",
    expire_after: 60 * 60,
  },
  coingeckoV1Tickers: {
    key: "coingecko_v1_tickers",
    expire_after: 12 * 60,
  },
  hydrationWebV1Stats: {
    key: "hydration-web_v1_stats",
    expire_after: 4 * 60 * 60,
  },
  hydradxUiV1StatsChartLrna: {
    key: "hydradx-ui_v1_stats_chart_lrna",
    expire_after: 10 * 60,
  },
  hydradxUiV1statsChartTvl: {
    key: "hydradx-ui_v1_stats_chart_tvl",
    expire_after: 10 * 60,
  },
  hydradxUiV1statsChartVolume: {
    key: "hydradx-ui_v1_stats_chart_volume",
    expire_after: 10 * 60,
  },
  hydradxUiV1StatsTvl: {
    key: "hydradx-ui_v1_stats_tvl",
    expire_after: 10 * 60,
  },
  hydradxUiV1StatsVolume: {
    key: "hydradx-ui_v1_stats_volume",
    expire_after: 60,
  },
  hydradxUiV1StatsFees: {
    key: "hydradx-ui_v1_stats_fees",
    expire_after: 10 * 60,
  },
  hydradxUiV1statsVolumeAlltime: {
    key: "hydradx-ui_v1_stats_volume_alltime",
    expire_after: 60,
  },
  hydradxUiV1StatsPrice: {
    key: "hydradx-ui_v1_stats_current_price",
    expire_after: 60,
  },
  defillamaV1Volume: {
    key: "defillama_v1_volume",
    expire_after: 10 * 60,
  },
  coinmarketcapV1Summary: {
    key: "coinmarketcap_v1_summary",
    expire_after: 12 * 60,
  },
  hydradxUiV2StatsFees: {
    key: "hydradx-ui_v2_stats_fees",
    expire_after: 10 * 60,
  },
  hydradxUiV2StatsTvl: {
    key: "hydradx-ui_v2_stats_tvl",
    expire_after: 3 * 60,
  },
  hydradxUiV2StatsVolume: {
    key: "hydradx-ui_v2_stats_volume",
    expire_after: 3 * 60,
  },
  hydradxUiV2statsVolumeAlltime: {
    key: "hydradx-ui_v2_stats_volume_alltime",
    expire_after: 60,
  },
  dexscreenerV1Asset: {
    key: "dexscreener_v1_asset",
    expire_after: 60,
  },
  dexscreenerV1Events: {
    key: "dexscreener_v1_events",
    expire_after: 60,
  },
  dexscreenerV1Latestblock: {
    key: "dexscreener_v1_latest_block",
    expire_after: 60,
  },
  dexscreenerV1Pair: {
    key: "dexscreener_v1_pair",
    expire_after: 60,
  },
};
