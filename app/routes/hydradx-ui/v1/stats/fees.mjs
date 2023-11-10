import yesql from "yesql";
import path from "path";
import { dirname } from "../../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../../variables.mjs";
import { cachedFetch } from "../../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/hydradx-ui/v1/stats"), {
  type: "pg",
});

export const VALID_TIMEFRAMES = ['day', 'week', 'month', 'year'];

export default async (fastify, opts) => {
  fastify.route({
    url: "/fees/:asset?",
    method: ["GET"],
    schema: {
      description: "Omnipool trading fees for the HydraDX stats page.",
      tags: ["hydradx-ui/v1"],
      params: {
        type: "object",
        properties: {
          asset: {
            type: "integer",
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
            default: "1mon",
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
              accrued_fees_usd: { type: "number" },
              projected_apy_perc: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const asset = request.params.asset ? request.params.asset : null;
      const timeframe = request.query.timeframe;

      const sqlQuery = sqlQueries.statsFees({ asset, timeframe });

      let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV1StatsFees"] };
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