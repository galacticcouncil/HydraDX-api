import yesql from "yesql";
import path from "path";
import { dirname } from "../../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../../variables.mjs";
import { readSqlCacheOrUpdate } from "../../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/hydradx-ui/v1/stats"), {
  type: "pg",
});

const VALID_TIMEFRAMES = ["hourly", "daily"];

export default async (fastify, opts) => {
  fastify.route({
    url: "/volume/:assetTicker?",
    method: ["GET"],
    schema: {
      description: "Omnipool trading volume for the HydraDX stats page.",
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
          timeframe: { type: "string", enum: VALID_TIMEFRAMES, default: "daily" },
        },
      },
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              datetime: { type: "string" },
              volume_usd: { type: "number" },
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

      const sqlQuery = sqlQueries.statsVolume({ assetTicker, timeframe })

      let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV1StatsVolume"] };
      cacheSetting.key = cacheSetting.key + "_" + assetTicker + "_" + timeframe;

      const result = await readSqlCacheOrUpdate(cacheSetting, sqlQuery);

      reply.send(JSON.parse(result));
    },
  });
};
