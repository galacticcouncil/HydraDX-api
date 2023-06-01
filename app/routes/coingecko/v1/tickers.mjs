import { newRedisClient } from "../../../../clients/redis.mjs";
import fs from "fs";

const TICKERS_QRY = fs
  .readFileSync("./queries/coingecko/tickers.sql")
  .toString();

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
      const cacheKey = request.url;

      const redis = await newRedisClient();
      let cache = await redis.get(cacheKey);

      if (cache === null) {
        const { rows } = await fastify.pg.query(TICKERS_QRY);

        await redis.set(cacheKey, JSON.stringify(rows));
        await redis.expire(cacheKey, 10);
        reply.send(rows);
      } else {
        reply.send(JSON.parse(cache));
      }
    },
  });
};
