import { CACHE_SETTINGS } from "../../../../variables.mjs";
import { neckworkGet } from "../../../../clients/neckwork.mjs";

// neckwork serves this shape natively off the live indexer, replacing the
// retired orca aggregation-indexer GraphQL (+ the ocelloids XCM call, whose
// figure neckwork now folds into xcm_vol_30d).
export default async (fastify, opts) => {
  fastify.route({
    url: "/stats",
    method: ["GET"],
    schema: {
      description: "Stats displayed on the Hydration homepage",
      tags: ["hydration-web/v1"],
      response: {
        200: {
          description: "Data displayed on Hydration homepage",
          type: "object",
          properties: {
            tvl: { type: "number" },
            vol_30d: { type: "number" },
            xcm_vol_30d: { type: "number" },
            assets_count: { type: "number" },
            accounts_count: { type: "number" },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const cacheSetting = CACHE_SETTINGS["hydrationWebV1Stats"];

      try {
        const cachedResult = await fastify.redis.get(cacheSetting.key);
        if (cachedResult) {
          return reply.send(JSON.parse(cachedResult));
        }

        const stats = await neckworkGet("/hydration-web/v1/stats");

        const result = {
          tvl: Number(stats.tvl) || 0,
          vol_30d: Number(stats.vol_30d) || 0,
          xcm_vol_30d: Number(stats.xcm_vol_30d) || 0,
          assets_count: Number(stats.assets_count) || 0,
          accounts_count: Number(stats.accounts_count) || 0,
        };

        await fastify.redis.set(cacheSetting.key, JSON.stringify(result));
        await fastify.redis.expire(cacheSetting.key, cacheSetting.expire_after);

        return reply.send(result);
      } catch (err) {
        request.log.error(err, "Failed to compute stats");
        return reply.status(500).send({ error: "Stats computation failed" });
      }
    },
  });
};
