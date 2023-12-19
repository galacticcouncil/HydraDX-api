import yesql from "yesql";
import path from "path";
import { dirname } from "../../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../../variables.mjs";
import { cachedFetch } from "../../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/hydradx-ui/v2/stats"), {
  type: "pg",
});

export const VALID_TIMEFRAMES = ["1d", "1w", "1mon", "1y"];

export default async (fastify, opts) => {
  fastify.route({
    url: "/fees/:asset?",
    method: ["GET"],
    schema: {
      description: "Omnipool trading fees for the HydraDX stats page.",
      tags: ["hydradx-ui/v2"],
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
              asset_id: { type: "integer" },
              accrued_fees_usd: { type: "number" },
              projected_apy_perc: { type: "number" },
              projected_apr_perc: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const asset =
        request.params.asset !== undefined && request.params.asset !== null
          ? request.params.asset.toString()
          : null;
      const timeframe = request.query.timeframe;

      const sqlQuery = sqlQueries.statsFees({ asset, timeframe });

      let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV2StatsFees"] };
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
