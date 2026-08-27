import { CACHE_SETTINGS } from "../../../../variables.mjs";
import { volumeForRange } from "../../../../helpers/defillama_source.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async (fastify, opts) => {
  fastify.route({
    url: "/volume/:asset?",
    method: ["GET"],
    schema: {
      description: "Current 24h rolling trading volume for DefiLlama.",
      tags: ["defillama/v1"],
      params: {
        type: "object",
        properties: {
          asset: {
            type: "string",
            description: "Asset (symbol). Leave empty for all assets.",
          },
        },
      },
    },
    handler: async (request, reply) => {
      // platform-wide figure, so the asset param does not change the answer
      const cacheSetting = CACHE_SETTINGS["defillamaV1Volume"];

      const cachedResult = await fastify.redis.get(cacheSetting.key);
      if (cachedResult) {
        return reply.send(JSON.parse(cachedResult));
      }

      try {
        const now = new Date();
        const result = await volumeForRange(
          fastify.redis,
          new Date(now.getTime() - DAY_MS),
          null
        );

        if (!result) {
          return reply.code(503).send({
            error: "Volume unavailable",
            message: "Archive returned no blocks for the last 24h",
          });
        }

        const response = [{ volume_usd: result.volumeUsd }];
        await fastify.redis.set(cacheSetting.key, JSON.stringify(response));
        await fastify.redis.expire(cacheSetting.key, cacheSetting.expire_after);

        return reply.send(response);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch volume data" });
      }
    },
  });
};
