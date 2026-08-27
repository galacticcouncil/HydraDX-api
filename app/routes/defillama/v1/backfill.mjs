import { gql, request as gqlRequest } from "graphql-request";

const GRAPHQL_ENDPOINT =
  "https://orca-sh-prod-pool-02.orca.hydration.cloud/graphql";

async function fetchVolumeForPeriod(startIsoString, endIsoString) {
  const timeout = (ms) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), ms)
    );

  const fetchData = async () => {
    const data = await gqlRequest(
      GRAPHQL_ENDPOINT,
      gql`
        query GetVolumeForPeriod(
          $startIsoString: String!
          $endIsoString: String!
        ) {
          platformTotalVolumesByPeriod(
            filter: {
              startIsoString: $startIsoString
              endIsoString: $endIsoString
            }
          ) {
            nodes {
              paraBlockHeight
              omnipoolFeeVolNorm
              omnipoolVolNorm
              stableswapFeeVolNorm
              stableswapVolNorm
              totalVolNorm
              xykpoolFeeVolNorm
              xykpoolVolNorm
            }
          }
        }
      `,
      {
        startIsoString,
        endIsoString,
      }
    );

    return data.platformTotalVolumesByPeriod.nodes[0];
  };

  return Promise.race([fetchData(), timeout(10000)]);
}

export default async (fastify, opts) => {
  fastify.route({
    url: "/backfill",
    method: ["GET"],
    schema: {
      description:
        "Historical volume and fees data for DefiLlama 2025 reindexing.",
      tags: ["defillama/v1"],
      querystring: {
        type: "object",
        properties: {
          startDate: {
            type: "string",
            description: "Start date in YYYY-MM-DD format (e.g., 2025-01-01)",
          },
          endDate: {
            type: "string",
            description:
              "End date in YYYY-MM-DD format (e.g., 2025-01-01). This date is inclusive - data up to and including this date.",
          },
        },
        required: ["startDate", "endDate"],
      },
    },
    handler: async (request, reply) => {
      try {
        const { startDate, endDate } = request.query;

        // Validate dates
        if (!startDate || !endDate) {
          return reply.code(400).send({
            error: "Both startDate and endDate are required",
          });
        }

        // Convert to ISO strings (assuming UTC timezone and midnight)
        const startIsoString = `${startDate}T00:00:00.000Z`;

        // Validate date format
        const startDateObj = new Date(startIsoString);
        const endDateObj = new Date(`${endDate}T00:00:00.000Z`);

        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
          return reply.code(400).send({
            error: "Invalid date format. Use YYYY-MM-DD",
          });
        }

        if (startDateObj > endDateObj) {
          return reply.code(400).send({
            error: "startDate must be before or equal to endDate",
          });
        }

        // Make endDate inclusive by adding 1 day to the end ISO string
        const endDatePlusOne = new Date(
          endDateObj.getTime() + 24 * 60 * 60 * 1000
        );
        const endIsoString = endDatePlusOne.toISOString();

        // Fetch from GraphQL
        const volumeData = await fetchVolumeForPeriod(
          startIsoString,
          endIsoString
        );

        // an empty result means the indexer never reached this range, not that
        // nothing traded. reporting 0 here wrote phantom zeros into DefiLlama's
        // series for 2026-08-25 onward while the processor was stalled.
        const rawVolume = volumeData?.totalVolNorm;
        const hasVolume =
          rawVolume !== null &&
          rawVolume !== undefined &&
          rawVolume !== "" &&
          Number.isFinite(Number(rawVolume));

        if (!hasVolume) {
          fastify.log.warn(
            `[defillama] indexer has no data for ${startDate}..${endDate}`
          );
          return reply.code(503).send({
            error: "Range not indexed",
            message: `The indexer has no data for ${startDate}..${endDate}; refusing to report zero volume`,
          });
        }

        // Calculate total fees (sum of all fee volumes)
        const totalFees =
          parseFloat(volumeData.omnipoolFeeVolNorm) +
          parseFloat(volumeData.stableswapFeeVolNorm) +
          parseFloat(volumeData.xykpoolFeeVolNorm);

        // Format response in defillama expected format
        const response = [
          {
            volume_usd: parseFloat(volumeData.totalVolNorm),
            dailyFees: totalFees,
          },
        ];

        reply.send(response);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: "Failed to fetch backfill volume data" });
      }
    },
  });
};
