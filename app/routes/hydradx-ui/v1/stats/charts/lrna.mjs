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
    url: "/lrna",
    method: ["GET"],
    schema: {
      description: "Chart data for LRNA price & supply.",
      tags: ["hydradx-ui/v1"],
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "string" },
              lrna_supply: { type: "number" },
              lrna_price: { type: "number" },
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

      const sqlQuery = sqlQueries.statsChartLrna();

      let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV1StatsChartLrna"] };

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
