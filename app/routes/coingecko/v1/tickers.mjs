import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../../../../variables.mjs";
import { readSqlCacheOrUpdate } from "../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/coingecko/v1/"), {
  type: "pg",
});

export default async (fastify, opts) => {
  fastify.route({
    url: "/tickers",
    method: ["GET"],
    schema: {
      description: "24h pricing and volume information for a given asset pair",
      tags: ["coingecko/v1"],
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              ticker_id: { type: "string" },
              base_currency: { type: "string" },
              target_currency: { type: "string" },
              last_price: { type: "number" },
              base_volume: { type: "number" },
              target_volume: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      let cacheSetting = CACHE_SETTINGS["coingeckoV1Tickers"];

      const result = await readSqlCacheOrUpdate(
        cacheSetting,
        sqlQueries.tickers()
      );

      reply.send(JSON.parse(result));
    },
  });
};
