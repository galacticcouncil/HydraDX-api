import yesql from "yesql";
import path from "path";
import { dirname } from "../../../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../../../variables.mjs";
import { cachedFetch } from "../../../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(
  path.join(dirname(), "queries/hydradx-ui/v1/stats/current"),
  {
    type: "pg",
  }
);

export default async (fastify, opts) => {
  fastify.route({
    url: "/volume/:asset?",
    method: ["GET"],
    schema: {
      description: "Current 24h rolling trading volume.",
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
              volume_usd: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const asset = request.params.asset ? request.params.asset : null;

      const sqlQuery = sqlQueries.statsCurrentVolume({ asset });

      let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV1StatsCurrentVolume"] };
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
