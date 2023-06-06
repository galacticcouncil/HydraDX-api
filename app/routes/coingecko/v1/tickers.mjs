import fs from "fs";
import { CACHE_SETTINGS } from "../../../../variables.mjs";
import { readSqlCacheOrUpdate } from "../../../../helpers/cache_helpers.mjs";

const TICKERS_QRY = fs
  .readFileSync("./queries/coingecko/tickers.sql")
  .toString();

export default async (fastify, opts) => {
  fastify.route({
    url: "/tickers",
    method: ["GET"],
    schema: {
      description: "24h pricing and volume information for a given asset pair",
      tags: ["coingecko/v1"],
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              ticker_id: { type: "string" },
              base_currency: { type: "string" },
              target_currency: { type: "string" },
              last_price: { type: "number" },
              base_volume: { type: "number" },
              target_volume: { type: "number" },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      let cacheSetting = CACHE_SETTINGS["coingeckoTickers"];

      const result = await readSqlCacheOrUpdate(cacheSetting, TICKERS_QRY);

      reply.send(JSON.parse(result));
    },
  });
};
