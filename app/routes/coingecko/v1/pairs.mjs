import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../../../../variables.mjs";
import { cachedFetch } from "../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/coingecko/v1/"), {
  type: "pg",
});

export default async (fastify, opts) => {
  fastify.route({
    url: "/pairs",
    method: ["GET"],
    schema: {
      description:
        "Pairs of assets which can be traded in the HydraDX Omnipool",
      tags: ["coingecko/v1"],
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              ticker_id: { type: "string" },
              base: { type: "string" },
              target: { type: "string" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      let cacheSetting = CACHE_SETTINGS["coingeckoV1Pairs"];

      const result = await cachedFetch(fastify.pg, cacheSetting, sqlQueries.getPairs());

      reply.send(result);
    },
  });
};
