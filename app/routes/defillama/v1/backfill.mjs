import { CACHE_SETTINGS } from "../../../../variables.mjs";
import { volumeForRange } from "../../../../helpers/defillama_source.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;

// each uncached day costs a full sweep of that day's swap events, so a range has
// to be bounded. matches the limit the reference implementation advertises.
const MAX_DAYS = 62;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

async function volumeForDay(redisClient, day) {
  const cacheSetting = CACHE_SETTINGS["defillamaV1Backfill"];
  const key = `${cacheSetting.key}:${day}`;

  const cached = await redisClient.get(key);
  if (cached) return JSON.parse(cached);

  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.getTime() + DAY_MS);
  const result = await volumeForRange(redisClient, start, end);

  // an archive with no blocks for this day is not the same statement as
  // "nothing traded". publishing 0 is what wrote phantom zeros into DefiLlama's
  // series while the old indexer was stalled — and caching it below would have
  // made that stick for 30 days.
  if (!result) {
    const error = new Error(`archive has no blocks for ${day}`);
    error.noDataDay = day;
    throw error;
  }

  const totals = {
    volume_usd: result.volumeUsd,
    dailyFees: result.feesUsd,
    // per-pool-type fee split so consumers (DefiLlama) can reproduce the
    // incumbent's fee/revenue breakdown; omnipool excludes LRNA-charged fees.
    fees: {
      xyk: result.feesUsdByPool.XYK,
      stableswap: result.feesUsdByPool.Stableswap,
      omnipool: result.feesUsdByPool.Omnipool,
    },
  };

  // only past days are settled; today's number still moves
  if (end.getTime() <= Date.now()) {
    await redisClient.set(key, JSON.stringify(totals));
    await redisClient.expire(key, cacheSetting.expire_after);
  }
  return totals;
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

        if (!startDate || !endDate) {
          return reply.code(400).send({
            error: "Both startDate and endDate are required",
          });
        }

        const startDateObj = new Date(`${startDate}T00:00:00.000Z`);
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

        const days = Math.round((endDateObj - startDateObj) / DAY_MS) + 1; // endDate inclusive
        if (days > MAX_DAYS) {
          return reply.code(400).send({
            error: `Date range too large. Maximum ${MAX_DAYS} days per request`,
          });
        }

        let volumeUsd = 0;
        let dailyFees = 0;
        for (let i = 0; i < days; i++) {
          const day = dayKey(new Date(startDateObj.getTime() + i * DAY_MS));
          const totals = await volumeForDay(fastify.redis, day);
          volumeUsd += totals.volume_usd;
          dailyFees += totals.dailyFees;
        }

        return reply.send([{ volume_usd: volumeUsd, dailyFees }]);
      } catch (error) {
        if (error.noDataDay) {
          fastify.log.warn(
            `[defillama] archive has no data for ${error.noDataDay}`
          );
          return reply.code(503).send({
            error: "Range not indexed",
            message: `The archive has no data for ${error.noDataDay}; refusing to report zero volume`,
          });
        }
        fastify.log.error(error);
        return reply
          .code(500)
          .send({ error: "Failed to fetch backfill volume data" });
      }
    },
  });
};
