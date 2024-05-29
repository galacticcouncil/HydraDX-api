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
    url: "/asset/:asset?",
    method: ["GET"],
    schema: {
      description: "Asset info",
      tags: ["dexscreener/v1"],
      params: {
        type: "object",
        properties: {
          asset: {
            type: "integer",
            description: "Asset (id). Leave empty for all assets.",
          },
        },
      },
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "integer" },
              name: { type: "string" },
              symbol: { type: "string" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const asset =
        request.params.asset !== undefined && request.params.asset !== null
          ? request.params.asset.toString()
          : null;

      const sqlQuery = sqlQueries.dexscreenerAsset({ asset });

      let cacheSetting = { ...CACHE_SETTINGS["dexscreenerV1Asset"] };
      cacheSetting.key = cacheSetting.key + "_" + asset;

      const result = await cachedFetch(
        fastify.pg,
        fastify.redis,
        cacheSetting,
        sqlQuery
      );

      reply.send(JSON.parse(result));
    },
  });
};
