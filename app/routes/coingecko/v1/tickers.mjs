import { CACHE_SETTINGS } from "../../../../variables.mjs";

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
              pool_id: { type: "string" },
              liquidity_in_usd: { type: "number" },
              high: { type: "number" },
              low: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      let cacheSetting = CACHE_SETTINGS["coingeckoV1Tickers"];

      // Read from cache (populated by cache_coingecko_tickers_job)
      const cachedResult = await fastify.redis.get(cacheSetting.key);

      if (cachedResult) {
        reply.send(JSON.parse(cachedResult));
      } else {
        reply.code(503).send({
          error: "Cache not populated",
          message: "Please wait for the cache job to populate data",
        });
      }
    },
  });
};
