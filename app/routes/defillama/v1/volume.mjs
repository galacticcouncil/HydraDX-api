import yesql from "yesql";
import path from "path";
import { dirname } from "../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../variables.mjs";
import { cachedFetch } from "../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/defillama/v1/"), {
  type: "pg",
});

export default async (fastify, opts) => {
  fastify.route({
    url: "/volume/:assetTicker?",
    method: ["GET"],
    schema: {
      description: "Actual 24h rolling trading volume for DefiLlama.",
      tags: ["defillama/v1"],
      params: {
        type: "object",
        properties: {
          assetTicker: {
            type: "string",
            description: "Ticker of the asset. Leave empty for all assets.",
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
              volume_usd: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const assetTicker = request.params.assetTicker
        ? request.params.assetTicker
        : null;

      const sqlQuery = sqlQueries.defillamaVolume({ assetTicker });

      let cacheSetting = { ...CACHE_SETTINGS["defillamaV1Volume"] };
      cacheSetting.key = cacheSetting.key + "_" + assetTicker;

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
