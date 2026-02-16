import { gql, request as gqlRequest } from "graphql-request";
import { CACHE_SETTINGS } from "../../../../variables.mjs";

const GRAPHQL_ENDPOINT =
  "https://hydration-history-7350000-8800000.shellfish.hydration.cloud/graphql";

// Block range for gap recovery
const MIN_BLOCK = 7350000;
const MAX_BLOCK = 8800000;

async function fetchBackfillVolumeFromGraphQL(startBlock, endBlock) {
  const data = await gqlRequest(
    GRAPHQL_ENDPOINT,
    gql`
      {
        platformTotalVolumesByPeriod(filter: { startBlockNumber: ${startBlock}, endBlockNumber: ${endBlock} }) {
          nodes {
            totalVolNorm
            omnipoolFeeVolNorm
            stableswapFeeVolNorm
            xykpoolFeeVolNorm
            paraBlockHeight
          }
        }
      }
    `
  );

  return data.platformTotalVolumesByPeriod.nodes;
}

export default async (fastify, opts) => {
  fastify.route({
    url: "/backfill-volume",
    method: ["GET"],
    schema: {
      description:
        "Historical volume data for DefiLlama gap recovery (blocks 7350000-8800000, 2025-04-16 to 2025-08-16).",
      tags: ["defillama/v1"],
      querystring: {
        type: "object",
        properties: {
          startBlock: {
            type: "integer",
            description: `Start block number (min: ${MIN_BLOCK}, max: ${MAX_BLOCK})`,
          },
          endBlock: {
            type: "integer",
            description: `End block number (min: ${MIN_BLOCK}, max: ${MAX_BLOCK})`,
          },
          startDate: {
            type: "string",
            description:
              "Start date in YYYY-MM-DD format (will be converted to block number)",
          },
          endDate: {
            type: "string",
            description:
              "End date in YYYY-MM-DD format (will be converted to block number)",
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        let { startBlock, endBlock, startDate, endDate } = request.query;

        // Date to block conversion
        // Block time changed at 7580313: 12s/block before, 6s/block after
        // 2025-04-16 = block 7350000
        const baseDate = new Date("2025-04-16T00:00:00Z");
        const baseBlock = 7350000;
        const transitionBlock = 7580313;
        const blocksPerDayOld = (24 * 60 * 60) / 12; // 7200 blocks/day at 12s
        const blocksPerDayNew = (24 * 60 * 60) / 6; // 14400 blocks/day at 6s

        // Calculate transition date
        const blocksToTransition = transitionBlock - baseBlock;
        const daysToTransition = blocksToTransition / blocksPerDayOld;
        const transitionDate = new Date(
          baseDate.getTime() + daysToTransition * 24 * 60 * 60 * 1000
        );

        if (startDate) {
          const start = new Date(startDate + "T00:00:00Z");
          if (start < transitionDate) {
            const daysDiff = (start - baseDate) / (1000 * 60 * 60 * 24);
            startBlock = Math.floor(baseBlock + daysDiff * blocksPerDayOld);
          } else {
            const daysAfterTransition =
              (start - transitionDate) / (1000 * 60 * 60 * 24);
            startBlock = Math.floor(
              transitionBlock + daysAfterTransition * blocksPerDayNew
            );
          }
        }

        if (endDate) {
          // For end date, we add one day to include the full day's data
          const end = new Date(endDate + "T00:00:00Z");
          const endPlusOne = new Date(end.getTime() + 24 * 60 * 60 * 1000);

          if (endPlusOne < transitionDate) {
            const daysDiff = (endPlusOne - baseDate) / (1000 * 60 * 60 * 24);
            endBlock = Math.floor(baseBlock + daysDiff * blocksPerDayOld);
          } else if (end < transitionDate) {
            // End date is before transition but end+1 is after
            const daysDiff = (end - baseDate) / (1000 * 60 * 60 * 24);
            const blocksBeforeTransition = Math.floor(
              baseBlock + daysDiff * blocksPerDayOld
            );
            const remainingHours =
              (endPlusOne - transitionDate) / (1000 * 60 * 60);
            const remainingBlocks = Math.floor((remainingHours * 60 * 60) / 6);
            endBlock = transitionBlock + remainingBlocks;
          } else {
            const daysAfterTransition =
              (endPlusOne - transitionDate) / (1000 * 60 * 60 * 24);
            endBlock = Math.floor(
              transitionBlock + daysAfterTransition * blocksPerDayNew
            );
          }
        }

        // Validate blocks are provided
        if (!startBlock || !endBlock) {
          return reply.code(400).send({
            error:
              "Either startBlock/endBlock or startDate/endDate must be provided",
          });
        }

        // Validate block range
        startBlock = parseInt(startBlock);
        endBlock = parseInt(endBlock);

        if (
          startBlock < MIN_BLOCK ||
          endBlock > MAX_BLOCK ||
          startBlock > endBlock
        ) {
          return reply.code(400).send({
            error: `Invalid block range. Must be between ${MIN_BLOCK} and ${MAX_BLOCK}, and startBlock <= endBlock`,
          });
        }

        // Fetch from GraphQL
        const volumeData = await fetchBackfillVolumeFromGraphQL(
          startBlock,
          endBlock
        );

        // Format response
        const response = volumeData.map((item) => ({
          volume_usd: parseFloat(item.totalVolNorm),
          fees_usd:
            parseFloat(item.omnipoolFeeVolNorm || 0) +
            parseFloat(item.stableswapFeeVolNorm || 0) +
            parseFloat(item.xykpoolFeeVolNorm || 0),
        }));

        reply.send(response);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: "Failed to fetch backfill volume data" });
      }
    },
  });
};
