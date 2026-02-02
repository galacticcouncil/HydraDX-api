export default async (fastify, opts) => {
  fastify.route({
    url: "/block-date-mapping",
    method: ["GET"],
    schema: {
      description:
        "Mapping between block numbers and dates for DefiLlama gap recovery period (blocks 7350000-8800000).",
      tags: ["defillama/v1"],
      querystring: {
        type: "object",
        properties: {
          block: {
            type: "integer",
            description: "Block number to convert to date",
          },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format to convert to block number",
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { block, date } = request.query;

        // Constants for the gap recovery period
        // 2025-04-16 = block 7350000
        // 2025-08-16 = block 8800000
        // Block time changed at 7580313: 12s/block before, 6s/block after
        const baseDate = new Date("2025-04-16T00:00:00Z");
        const baseBlock = 7350000;
        const endDate = new Date("2025-08-16T00:00:00Z");
        const endBlock = 8800000;
        const transitionBlock = 7580313;
        const blocksPerDayOld = (24 * 60 * 60) / 12; // 7200 blocks/day at 12s
        const blocksPerDayNew = (24 * 60 * 60) / 6; // 14400 blocks/day at 6s

        // Calculate transition date
        const blocksToTransition = transitionBlock - baseBlock;
        const daysToTransition = blocksToTransition / blocksPerDayOld;
        const transitionDate = new Date(
          baseDate.getTime() + daysToTransition * 24 * 60 * 60 * 1000
        );

        if (block) {
          const blockNum = parseInt(block);

          // Validate block range
          if (blockNum < baseBlock || blockNum > endBlock) {
            return reply.code(400).send({
              error: `Block must be between ${baseBlock} and ${endBlock}`,
            });
          }

          // Calculate date from block
          let resultDate;
          if (blockNum < transitionBlock) {
            // Before transition: 12s blocks
            const blocksDiff = blockNum - baseBlock;
            const daysDiff = blocksDiff / blocksPerDayOld;
            resultDate = new Date(
              baseDate.getTime() + daysDiff * 24 * 60 * 60 * 1000
            );
          } else {
            // After transition: 6s blocks
            const blocksAfterTransition = blockNum - transitionBlock;
            const daysAfterTransition = blocksAfterTransition / blocksPerDayNew;
            resultDate = new Date(
              transitionDate.getTime() +
                daysAfterTransition * 24 * 60 * 60 * 1000
            );
          }

          return reply.send({
            block: blockNum,
            date: resultDate.toISOString().split("T")[0],
            timestamp: resultDate.toISOString(),
          });
        } else if (date) {
          const queryDate = new Date(date + "T00:00:00Z");

          // Validate date range
          if (queryDate < baseDate || queryDate > endDate) {
            return reply.code(400).send({
              error: `Date must be between 2025-04-16 and 2025-08-16`,
            });
          }

          // Calculate block from date
          let resultBlock;
          let note;
          if (queryDate < transitionDate) {
            // Before transition: 12s blocks
            const daysDiff = (queryDate - baseDate) / (1000 * 60 * 60 * 24);
            resultBlock = Math.floor(baseBlock + daysDiff * blocksPerDayOld);
            note =
              "Block number is approximate based on 12 seconds per block (before block 7580313)";
          } else {
            // After transition: 6s blocks
            const daysAfterTransition =
              (queryDate - transitionDate) / (1000 * 60 * 60 * 24);
            resultBlock = Math.floor(
              transitionBlock + daysAfterTransition * blocksPerDayNew
            );
            note =
              "Block number is approximate based on 6 seconds per block (after block 7580313)";
          }

          return reply.send({
            date: date,
            block: resultBlock,
            approximate: true,
            note: note,
          });
        } else {
          // Return the full mapping reference
          return reply.send({
            period: {
              start: {
                block: baseBlock,
                date: "2025-04-16",
              },
              transition: {
                block: transitionBlock,
                date: transitionDate.toISOString().split("T")[0],
                note: "Block time changed from 12s to 6s",
              },
              end: {
                block: endBlock,
                date: "2025-08-16",
              },
            },
            blockTimes: {
              before7580313: {
                secondsPerBlock: 12,
                blocksPerDay: Math.floor(blocksPerDayOld),
              },
              after7580313: {
                secondsPerBlock: 6,
                blocksPerDay: Math.floor(blocksPerDayNew),
              },
            },
            usage: {
              examples: [
                "?block=7350000 - Get date for specific block",
                "?date=2025-04-16 - Get block for specific date",
              ],
            },
          });
        }
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({ error: "Failed to process mapping request" });
      }
    },
  });
};
