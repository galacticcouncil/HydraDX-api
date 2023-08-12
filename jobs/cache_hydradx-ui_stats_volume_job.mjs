import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../variables.mjs";
import { updateCache } from "../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/hydradx-ui/v1/stats"), {
  type: "pg",
});

export async function cacheHydradxUiStatsVolumeJob(sqlClient, redisClient) {
  await updateCache(
    sqlClient,
    redisClient,
    CACHE_SETTINGS["hydradxUiV1StatsVolume"],
    sqlQueries.statsVolume()
  );

  return true;
};
