import { CACHE_SETTINGS } from "../../../../variables.mjs";
import { refreshVolume24h } from "../../../../helpers/defillama_source.mjs";

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

      // cold sweep on a request path is slow, so the warm job normally gets
      // here first; this is the fallback when the cache has lapsed.
      try {
        const response = await refreshVolume24h(fastify.redis);
        if (response) return reply.send(response);
        fastify.log.warn("[defillama] archive returned no blocks for 24h");
      } catch (error) {
        fastify.log.error(error);
      }

      const lastGood = await fastify.redis.get(cacheSetting.last_good_key);
      if (lastGood) {
        return reply.send(JSON.parse(lastGood));
      }

      return reply.code(503).send({
        error: "Volume unavailable",
        message:
          "The archive returned no data and no cached result is available",
      });
    },
  });
};
