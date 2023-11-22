import yesql from "yesql";
import path from "path";
import { dirname } from "../../../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../../../variables.mjs";
import { cachedFetch } from "../../../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(
  path.join(dirname(), "queries/hydradx-ui/v1/stats/charts"),
  {
    type: "pg",
  }
);

export const VALID_TIMEFRAMES = ["hourly", "daily"];

export default async (fastify, opts) => {
  fastify.route({
    url: "/volume/:asset?",
    method: ["GET"],
    schema: {
      description: "Chart data for Omnipool trading volume.",
      tags: ["hydradx-ui/v1"],
      params: {
        type: "object",
        properties: {
          asset: {
            type: "string",
            description: "Asset (id). Leave empty for all assets.",
          },
        },
      },
      querystring: {
        type: "object",
        properties: {
          timeframe: {
            type: "string",
            enum: VALID_TIMEFRAMES,
            default: "daily",
          },
        },
      },
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "string" },
              volume_usd: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const asset = request.params.asset ? request.params.asset.toString() : null;
      const timeframe = request.query.timeframe;

      const sqlQuery = sqlQueries.statsChartVolume({ asset, timeframe });

      let cacheSetting = {
        ...CACHE_SETTINGS["hydradxUiV1statsChartVolume"],
      };
      cacheSetting.key = cacheSetting.key + "_" + asset + "_" + timeframe;

      const result = await cachedFetch(
        fastify.pg,
        fastify.redis,
        cacheSetting,
        sqlQuery
      );

      reply.send(JSON.parse(result));
    },
  });
};
