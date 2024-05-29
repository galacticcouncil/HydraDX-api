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
    url: "/pair/:pair?",
    method: ["GET"],
    schema: {
      description: "Pair info",
      tags: ["dexscreener/v1"],
      params: {
        type: "object",
        properties: {
          pair: {
            type: "string",
            description: "Pair (id). Leave empty for all pairs.",
          },
        },
      },
      response: {
        200: {
          description: "Success Response",
          type: "object",
          properties: {
            pair: {
              type: "object",
              properties: {
                id: { type: "string" },
                dexKey: { type: "string" },
                asset0Id: { type: "integer" },
                asset1Id: { type: "integer" },
                feeBps: { type: "integer" },
              },
              required: [
                "id",
                "dexKey",
                "asset0Id",
                "asset1Id",
                "feeBps"
              ]
            }
          }
        },
      },
    },
    handler: async (request, reply) => {
      const pair = request.params.pair ? request.params.pair.toString() : null;

      const sqlQuery = sqlQueries.dexscreenerPair({ pair });

      let cacheSetting = { ...CACHE_SETTINGS["dexscreenerV1Pair"] };
      cacheSetting.key = cacheSetting.key + (pair ? `_${pair}` : "");

      const result = await cachedFetch(
        fastify.pg,
        fastify.redis,
        cacheSetting,
        sqlQuery
      );

      const pairData = JSON.parse(result)[0];
      const formattedResult = {
        pair: {
          id: pairData.id,
          dexKey: pairData.dexkey,
          asset0Id: pairData.asset0id,
          asset1Id: pairData.asset1id,
          createdAtBlockNumber: pairData.createdatblocknumber,
          createdAtBlockTimestamp: pairData.createdatblocktimestamp,
          createdAtTxnId: pairData.createdattxnid,
          feeBps: pairData.feebps,
        }
      };

      reply.send(formattedResult);
    },
  });
};
