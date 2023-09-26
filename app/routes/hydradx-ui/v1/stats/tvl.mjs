import yesql from "yesql";
import path from "path";
import { dirname } from "../../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../../variables.mjs";
import { cachedFetch } from "../../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/hydradx-ui/v1/stats"), {
  type: "pg",
});

export default async (fastify, opts) => {
  fastify.route({
    url: "/tvl/:asset?",
    method: ["GET"],
    schema: {
      description: "Omnipool TVL for the HydraDX stats page.",
      tags: ["hydradx-ui/v1"],
      params: {
        type: "object",
        properties: {
          asset: {
            type: "string",
            description: "Asset (symbol). Leave empty for all assets.",
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

      const sqlQuery = sqlQueries.statsTvl({ asset });

      let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV1StatsTvl"] };
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
