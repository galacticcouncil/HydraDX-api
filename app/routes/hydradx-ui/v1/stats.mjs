import yesql from "yesql";
import path from "path";
import { dirname } from "../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../variables.mjs";
import { readSqlCacheOrUpdate } from "../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/hydradx-ui/v1/"), {
  type: "pg",
});

const VALID_TIMEFRAMES = ["all", "weekly", "daily"];

export default async (fastify, opts) => {
  fastify.route({
    url: "/stats/:assetTicker?",
    method: ["GET"],
    schema: {
      description: "Omnipool asset data for the HydraDX stats page.",
      tags: ["hydradx-ui/v1"],
      params: {
        type: "object",
        properties: {
          assetTicker: {
            type: "string",
            description: "Ticker of the asset. Leave empty for all assets.",
          },
        },
      },
      querystring: {
        type: "object",
        properties: {
          timeframe: { type: "string", enum: VALID_TIMEFRAMES, default: "all" },
        },
      },
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              interval: { type: "string" },
              volume_usd: { type: "number" },
              tvl_usd: { type: "number" },
              tvl_pol_usd: { type: "number" },
              volume_roll_24_usd: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const assetTicker = request.params.assetTicker
        ? request.params.assetTicker
        : null;
      const timeframe = request.query.timeframe;

      const sqlQuerySeconds = timeframe == "weekly" ? 10080 : 1440;
      const sqlQuerySecondsLabel = sqlQuerySeconds.toString() + "s";
      const sqlQuery =
        timeframe == "all"
          ? sqlQueries.statsAll({ assetTicker })
          : sqlQueries.statsPeriodic({
              assetTicker,
              sqlQuerySeconds,
              sqlQuerySecondsLabel,
            });

      let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV1stats"] };
      cacheSetting.key = cacheSetting.key + "_" + assetTicker + "_" + timeframe;

      const result = await readSqlCacheOrUpdate(cacheSetting, sqlQuery);

      reply.send(JSON.parse(result));
    },
  });
};
