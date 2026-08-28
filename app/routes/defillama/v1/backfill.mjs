import { defillamaTrustedFrom } from "../../../../variables.mjs";
import { volumeForDay } from "../../../../helpers/defillama_source.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;

// each uncached day costs a full sweep of that day's swap events, so a range has
// to be bounded. matches the limit the reference implementation advertises.
const MAX_DAYS = 62;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
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

        // refusing beats answering with numbers we know are wrong: a consumer
        // re-running a backfill over the early era would replace correct
        // history with zeros or 40%-off figures.
        const trustedFrom = defillamaTrustedFrom();
        if (startDate < trustedFrom) {
          return reply.code(400).send({
            error: "Range predates reliable coverage",
            message: `This endpoint only serves days from ${trustedFrom} onward; ${startDate} is earlier. Before that the archive lacks the unified swap event and the derived figures diverge from the historical series`,
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
        const fees = { xyk: 0, stableswap: 0, omnipool: 0 };
        for (let i = 0; i < days; i++) {
          const day = dayKey(new Date(startDateObj.getTime() + i * DAY_MS));
          const totals = await volumeForDay(fastify.redis, day);
          volumeUsd += totals.volume_usd;
          dailyFees += totals.dailyFees;
          if (totals.fees) {
            fees.xyk += totals.fees.xyk;
            fees.stableswap += totals.fees.stableswap;
            fees.omnipool += totals.fees.omnipool;
          }
        }

        return reply.send([{ volume_usd: volumeUsd, dailyFees, fees }]);
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
