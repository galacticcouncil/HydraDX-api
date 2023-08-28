import yesql from "yesql";
import path from "path";
import { dirname, CACHE_SETTINGS } from "../../../../variables.mjs";
import { cachedFetch } from "../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/coinmarketcap/v1/"), {
  type: "pg",
});

export default async (fastify, opts) => {
  fastify.route({
    url: "/summary",
    method: ["GET"],
    schema: {
      description: "24h pricing and volume information for a given asset pair",
      tags: ["coinmarketcap/v1"],
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              trading_pairs: { type: "string" },
              base_currency: { type: "string" },
              quote_currency: { type: "string" },
              last_price: { type: "number" },
              lowest_ask: { type: "number" },
              highest_bid: { type: "number" },
              base_volume: { type: "number" },
              target_volume: { type: "number" },
              price_change_percent_24h: { type: "number" },
              highest_price_24h: { type: "number" },
              lowest_price_24h: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      let cacheSetting = CACHE_SETTINGS["coinmarketcapV1Summary"];

      const result = await cachedFetch(
        fastify.pg,
        fastify.redis,
        cacheSetting,
        sqlQueries.coinmarketcapSummary()
      );

      reply.send(JSON.parse(result));
    },
  });
};
