import { gql, request as gqlRequest } from "graphql-request";
import { CACHE_SETTINGS } from "../../../../variables.mjs";

const GRAPHQL_ENDPOINT =
  "https://orca-main-aggr-indx.indexer.hydration.cloud/graphql";

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

// an empty nodes array means the indexer has no window to report, which is not
// the same statement as "volume was zero". a genuinely flat period still comes
// back as a node with totalVolNorm "0", so only absence is treated as no data.
function parseVolume(node) {
  const raw = node?.totalVolNorm;
  // Number(null) and Number("") are both 0, which would read as a flat period
  if (raw === null || raw === undefined || raw === "") return null;
  const volume = Number(raw);
  return Number.isFinite(volume) ? volume : null;
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
        const lastGoodKey = `${cacheSetting.key}_last_good`;

        // Check cache first
        const cachedResult = await fastify.redis.get(cacheSetting.key);
        if (cachedResult) {
          return reply.send(JSON.parse(cachedResult));
        }

        // Fetch from GraphQL
        const volumeData = await fetchVolumeFromGraphQL();
        const volume = parseVolume(volumeData);

        if (volume === null) {
          const lastGood = await fastify.redis.get(lastGoodKey);
          if (lastGood) {
            fastify.log.warn(
              "[defillama] indexer reported no 24h window, serving last known good"
            );
            return reply.send(JSON.parse(lastGood));
          }
          return reply.code(503).send({
            error: "Volume unavailable",
            message:
              "The indexer has no 24h window to report and no cached result is available",
          });
        }

        // Format response to maintain original format - array with single object
        const response = [{ volume_usd: volume }];
        const json = JSON.stringify(response);

        // Cache the result using the correct expire_after setting
        await fastify.redis.set(cacheSetting.key, json);
        await fastify.redis.expire(cacheSetting.key, cacheSetting.expire_after);
        await fastify.redis.set(lastGoodKey, json);
        await fastify.redis.expire(lastGoodKey, 24 * 60 * 60);

        reply.send(response);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: "Failed to fetch volume data" });
      }
    },
  });
};
