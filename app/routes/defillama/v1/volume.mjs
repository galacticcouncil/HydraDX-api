import { gql, request as gqlRequest } from "graphql-request";
import { CACHE_SETTINGS } from "../../../../variables.mjs";

const GRAPHQL_ENDPOINT =
  "https://galacticcouncil.squids.live/hydration-pools:whale-prod/api/graphql";

async function fetchVolumeFromGraphQL() {
  const data = await gqlRequest(
    GRAPHQL_ENDPOINT,
    gql`
      {
        platformTotalVolumesByPeriod(filter: { period: _24H_ }) {
          nodes {
            totalVolNorm
            omnipoolVolNorm
            omnipoolFeeVolNorm
            stableswapVolNorm
            stableswapFeeVolNorm
            xykpoolVolNorm
            xykpoolFeeVolNorm
            paraBlockHeight
          }
        }
      }
    `
  );

  return data.platformTotalVolumesByPeriod.nodes[0];
}

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
      try {
        // Use a cache key that doesn't depend on asset since we're getting platform-wide data
        let cacheSetting = { ...CACHE_SETTINGS["defillamaV1Volume"] };
        cacheSetting.key = "defillama_v1_volume_graphql_array_format";

        // Check cache first
        const cachedResult = await fastify.redis.get(cacheSetting.key);
        if (cachedResult) {
          return reply.send(JSON.parse(cachedResult));
        }

        // Fetch from GraphQL
        const volumeData = await fetchVolumeFromGraphQL();

        // Format response to maintain original format - array with single object
        const response = [
          {
            volume_usd: parseFloat(volumeData.totalVolNorm),
          },
        ];

        // Cache the result using the correct expire_after setting
        await fastify.redis.set(cacheSetting.key, JSON.stringify(response));
        await fastify.redis.expire(cacheSetting.key, cacheSetting.expire_after);

        reply.send(response);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: "Failed to fetch volume data" });
      }
    },
  });
};
