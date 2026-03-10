import { CACHE_SETTINGS } from "../../../variables.mjs";

export default async (fastify, opts) => {
  fastify.route({
    url: "/cache",
    method: ["GET"],
    schema: {
      description: "Cache (Redis) health check",
      tags: ["health"],
      response: {
        200: {
          description: "Success Response",
          type: "object",
          properties: {
            alive: { type: "boolean" },
            keys: {
              type: "object",
              additionalProperties: { type: "boolean" },
            },
          },
        },
      },
    },
    handler: async (_, response) => {
      const redis = fastify.redis;

      const pong = await redis.ping();

      const keyChecks = await Promise.all(
        Object.entries(CACHE_SETTINGS).map(async ([name, setting]) => {
          const exists = await redis.exists(setting.key);
          return [name, exists === 1];
        })
      );

      response.send({
        alive: pong === "PONG",
        keys: Object.fromEntries(keyChecks),
      });
    },
  });
};
