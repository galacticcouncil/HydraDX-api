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
    url: "/asset",
    method: ["GET"],
    schema: {
      description: "Asset info",
      tags: ["dexscreener/v1"],
      querystring: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Asset (id). Leave empty for all assets.",
          },
        },
        additionalProperties: false,
      },
      response: {
        200: {
          description: "Success Response",
          oneOf: [
            {
              type: "object",
              properties: {
                pair: {
                  type: "object",
                  properties: {
                    id: { type: "integer" },
                    name: { type: "string" },
                    symbol: { type: "string" },
                  },
                  required: ["id", "name", "symbol"],
                },
              },
            },
            {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  name: { type: "string" },
                  symbol: { type: "string" },
                },
                required: ["id", "name", "symbol"],
              },
            },
          ],
        },
      },
    },
    handler: async (request, reply) => {
      const asset = request.query.id ? request.query.id.toString() : null;

      const sqlQuery = sqlQueries.dexscreenerAsset({ asset });

      let cacheSetting = { ...CACHE_SETTINGS["dexscreenerV1Asset"] };
      cacheSetting.key = cacheSetting.key + (asset ? `_${asset}` : "");

      const result = await cachedFetch(
        fastify.pg,
        fastify.redis,
        cacheSetting,
        sqlQuery
      );

      const assetsData = JSON.parse(result);

      if (asset) {
        if (assetsData.length === 0) {
          reply.code(404).send({ error: "Asset not found" });
        } else {
          const assetData = assetsData[0];
          const formattedResult = {
            id: assetData.id,
            name: assetData.name,
            symbol: assetData.symbol,
          };
          reply.send({ pair: formattedResult });
        }
      } else {
        const formattedResult = assetsData.map(assetData => ({
          id: assetData.id,
          name: assetData.name,
          symbol: assetData.symbol,
        }));
        reply.send(formattedResult);
      }
    },
  });
};
