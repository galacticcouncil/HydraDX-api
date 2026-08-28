import { CACHE_SETTINGS } from "../../../../variables.mjs";
import { neckworkGet } from "../../../../clients/neckwork.mjs";

// neckwork serves the full money-market cap set off the live indexer,
// replacing the retired orca aggregation-indexer GraphQL (borrow cap) and the
// dwellir RPC totalSupply call (current borrow) the old handler stitched
// together. we keep the historical contract: the core-market HOLLAR
// facilitator entry, mapped to { asset, borrowCap, currentBorrow, available }.
// neckwork returns every reserve with richer fields — a future revision can
// widen this endpoint to expose them.
export default async (fastify, opts) => {
  fastify.route({
    url: "/caps",
    method: ["GET"],
    schema: {
      description:
        "Borrow caps and current borrow levels for money market assets",
      tags: ["lending/v1"],
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              asset: {
                type: "string",
                description: "Asset name",
              },
              borrowCap: {
                type: "number",
                description: "Maximum borrow capacity",
              },
              currentBorrow: {
                type: "number",
                description: "Current borrow level",
              },
              available: {
                type: "number",
                description: "Available capacity (borrowCap - currentBorrow)",
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const cacheSetting = CACHE_SETTINGS["lendingV1Caps"];

        const cachedResult = await fastify.redis.get(cacheSetting.key);
        if (cachedResult) {
          return reply.send(JSON.parse(cachedResult));
        }

        const rows = await neckworkGet("/lending/v1/caps");
        const hollar = Array.isArray(rows)
          ? rows.find((r) => r.symbol === "HOLLAR" && r.market === "core")
          : null;

        if (!hollar) {
          throw new Error("No Hollar borrow cap data found");
        }

        const capsData = [
          {
            asset: "Hydrated Dollar",
            borrowCap: Number(hollar.borrowCap),
            currentBorrow: Number(hollar.currentBorrow),
            available: Number(hollar.available),
          },
        ];

        await fastify.redis.set(cacheSetting.key, JSON.stringify(capsData));
        await fastify.redis.expire(cacheSetting.key, cacheSetting.expire_after);

        reply.send(capsData);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          error: "Failed to fetch lending caps data",
          message: error.message,
        });
      }
    },
  });
};
