import { newRedisClient } from "../../../clients/redis.mjs";

export default async (fastify, opts) => {
  fastify.route({
    url: "/cache",
    method: ["GET"],
    schema: {
      description: "RPC health check, returns block height",
      tags: ["health"],
      response: {
        200: {
          description: "Success Response",
          type: "object",
          properties: {
            block_height: { type: "number" },
          },
        },
      },
    },
    handler: async (_, response) => {
      const redis = await newRedisClient();
      let cache = await redis.get("cache_rpc_block_height");

      response.send(JSON.parse(cache));
    },
  });
};
