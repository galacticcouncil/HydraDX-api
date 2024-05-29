import yesql from "yesql";
import path from "path";
import { dirname } from "../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../variables.mjs";
import { cachedFetch } from "../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/dexscreener/v1/"), {
  type: "pg",
});

export default async (fastify, opts) => {
  fastify.route({
    url: "/latest-block",
    method: ["GET"],
    schema: {
      description:
        "Pairs of assets which can be traded in the HydraDX Omnipool",
      tags: ["dexscreener/v1"],
      response: {
        200: {
          description: "Success Response",
          type: "object",
          properties: {
            block: {
              type: "object",
              properties: {
                blockNumber: { type: "integer" },
                blockTimestamp: { type: "integer" }
              },
              required: ["blockNumber", "blockTimestamp"]
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      let cacheSetting = CACHE_SETTINGS["dexscreenerV1Latestblock"];

      const result = await cachedFetch(
        fastify.pg,
        fastify.redis,
        cacheSetting,
        sqlQueries.dexscreenerLatestblock()
      );

      // Parse and transform the result
      const latestBlock = JSON.parse(result)[0];
      const formattedResult = {
        block: {
          blockNumber: latestBlock.blocknumber,
          blockTimestamp: parseInt(latestBlock.blocktimestamp)
        }
      };

      reply.send(formattedResult);
    },
  });
};
