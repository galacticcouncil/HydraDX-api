import { newRedisClient } from "../../../../clients/redis.mjs";
import fs from "fs";

const PAIRS_QRY = fs.readFileSync("./queries/coingecko/pairs.sql").toString();

const CACHE_EXPIRE = 3600;

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
      const cacheKey = request.url;

      const redis = await newRedisClient();
      let cache = await redis.get(cacheKey);

      if (cache === null) {
        const { rows } = await fastify.pg.query(PAIRS_QRY);

        await redis.set(cacheKey, JSON.stringify(rows));
        await redis.expire(cacheKey, CACHE_EXPIRE);
        reply.send(rows);
      } else {
        reply.send(JSON.parse(cache));
      }
    },
  });
};
