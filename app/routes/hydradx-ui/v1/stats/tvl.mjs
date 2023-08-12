import yesql from "yesql";
import path from "path";
import { dirname } from "../../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../../variables.mjs";
import { cachedFetch } from "../../../../../helpers/cache_helpers.mjs";
import { getAssets } from "../../../../../helpers/asset_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/hydradx-ui/v1/stats"), {
  type: "pg",
});

export default async (fastify, opts) => {
  fastify.route({
    url: "/tvl/:assetTicker?",
    method: ["GET"],
    schema: {
      description: "Omnipool TVL for the HydraDX stats page.",
      tags: ["hydradx-ui/v1"],
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
              interval: { type: "string" },
              tvl_usd: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const assetTicker = request.params.assetTicker
        ? request.params.assetTicker
        : null;

      const sqlQuery = sqlQueries.statsTvl({ assetTicker });

      let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV1StatsTvl"] };
      cacheSetting.key = cacheSetting.key + "_" + assetTicker;

      const result = await cachedFetch(fastify.pg, cacheSetting, sqlQuery);

      reply.send(JSON.parse(result));
    },
  });
};
