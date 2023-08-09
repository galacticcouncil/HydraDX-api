import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../variables.mjs";
import { updateSqlCache } from "../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/defillama/v1/volume/"), {
  type: "pg",
});

export const cacheDefillamaVolumeJob = async () => {
  await updateSqlCache(
    CACHE_SETTINGS["defillamaV1Volume"],
    sqlQueries.defillamaVolume()
  );

  return true;
};
