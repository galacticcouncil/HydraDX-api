import yesql from "yesql";
import path from "path";
import dayjs from "dayjs";
import { dirname } from "../../../../../variables.mjs";
import { CACHE_SETTINGS } from "../../../../../variables.mjs";
import { cachedFetch } from "../../../../../helpers/cache_helpers.mjs";

const sqlQueries = yesql(path.join(dirname(), "queries/hydradx-ui/v1/trade"), {
  type: "pg",
});

export const VALID_TIMEFRAMES = ["hourly", "daily"];

export default async (fastify, opts) => {
  fastify.route({
    url: "/price_chart/:assetIn-:assetOut",
    method: ["GET"],
    schema: {
      description: "Price chart (Omnipool) for the trade page.",
      tags: ["hydradx-ui/v1"],
      params: {
        type: "object",
        properties: {
          assetIn: {
            type: "string",
            description: "Symbol for assetIn",
          },
          assetOut: {
            type: "string",
            description: "Symbol for assetOut",
          },
        },
        required: ["assetIn", "assetOut"],
      },
    },
    handler: async (request, reply) => {
      const assetIn = request.params.assetIn;
      const assetOut = request.params.assetOut;
      const endOfDay = dayjs().endOf("day").format("YYYY-MM-DDTHH:mm:ss");

      const sqlQuery = sqlQueries.priceChart({ assetIn, assetOut, endOfDay });

      let cacheSetting = { ...CACHE_SETTINGS["hydradxUiV1TradePriceChart"] };
      cacheSetting.key = cacheSetting.key + "_" + assetIn + "_" + assetOut;

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
