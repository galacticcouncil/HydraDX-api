import yesql from "yesql";
import path from "path";
import { dirname } from "../../../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../../../variables.mjs";
import { cachedFetch } from "../../../../../../helpers/cache_helpers.mjs";
import { getAssets } from "../../../../../../helpers/asset_helpers.mjs";

const sqlQueries = yesql(
  path.join(dirname(), "queries/hydradx-ui/v1/stats/charts"),
  {
    type: "pg",
  }
);

export default async (fastify, opts) => {
  fastify.route({
    url: "/tvl/:asset?",
    method: ["GET"],
    schema: {
      description: "Chart data for Omnipool TVL.",
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
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "string" },
              tvl_usd: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const asset = request.params.asset ? request.params.asset : null;

      const sqlQuery = sqlQueries.statsChartTvl({ asset });

      let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV1statsChartTvl"] };
      cacheSetting.key = cacheSetting.key + "_" + asset;

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
