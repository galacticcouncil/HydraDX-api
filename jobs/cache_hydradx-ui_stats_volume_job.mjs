import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../variables.mjs";
import { updateSqlCache } from "../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/hydradx-ui/v1/stats/volume/"), {
  type: "pg",
});

export const cacheHydradxUiStatsTvlJob = async () => {
  await updateSqlCache(
    CACHE_SETTINGS["hydradxUiV1StatsVolume"],
    sqlQueries.statsVolume()
  );

  return true;
};
