import { CACHE_SETTINGS } from "../../../../variables.mjs";
import { fetchIncumbentTickers } from "../../../../helpers/coingecko_shape.mjs";

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
      const cacheSetting = CACHE_SETTINGS["coingeckoV1Tickers"];

      // warmed by cache_coingecko_tickers_job
      const cachedResult = await fastify.redis.get(cacheSetting.key);
      if (cachedResult) {
        return reply.send(JSON.parse(cachedResult));
      }

      // cache cold or expired: fetch inline rather than answer 503
      try {
        const tickers = await fetchIncumbentTickers();
        if (tickers.length > 0) {
          const json = JSON.stringify(tickers);
          await fastify.redis.set(cacheSetting.key, json);
          await fastify.redis.expire(
            cacheSetting.key,
            cacheSetting.expire_after
          );
          await fastify.redis.set(cacheSetting.last_good_key, json);
          await fastify.redis.expire(
            cacheSetting.last_good_key,
            cacheSetting.last_good_expire_after
          );
          return reply.send(tickers);
        }
        fastify.log.warn("[coingecko] upstream returned 0 tickers");
      } catch (error) {
        fastify.log.error(error);
      }

      const lastGood = await fastify.redis.get(cacheSetting.last_good_key);
      if (lastGood) {
        return reply.send(JSON.parse(lastGood));
      }

      return reply.code(503).send({
        error: "Tickers unavailable",
        message: "Upstream returned no data and no cached result is available",
      });
    },
  });
};
