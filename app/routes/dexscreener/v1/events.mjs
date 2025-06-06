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
    url: "/events_deprecated",
    method: ["GET"],
    schema: {
      description: "Events info",
      tags: ["dexscreener/v1"],
      querystring: {
        type: "object",
        properties: {
          fromBlock: {
            type: "integer",
            description: "Events starting at a block number.",
          },
          toBlock: {
            type: "integer",
            description: "Events until a block number.",
          },
        },
        required: ["fromBlock", "toBlock"],
        additionalProperties: false,
      },
      response: {
        200: {
          description: "Success Response",
          type: "array",
          items: {
            type: "object",
            properties: {
              block: {
                type: "object",
                properties: {
                  blockNumber: { type: "integer" },
                  blockTimestamp: { type: "integer" },
                },
                required: ["blockNumber", "blockTimestamp"],
              },
              eventType: { type: "string" },
              txnId: { type: "string" },
              txnIndex: { type: "integer" },
              eventIndex: { type: "integer" },
              maker: { type: "string" },
              pairId: { type: "string" },
              asset0In: { type: "number" },
              asset1Out: { type: "number" },
              amount0: { type: "number" },
              amount1: { type: "number" },
              priceNative: { type: "number" },
              reserves: {
                type: "object",
                properties: {
                  asset0: { type: "number" },
                  asset1: { type: "number" },
                },
                required: ["asset0", "asset1"],
              },
            },
            required: [
              "block",
              "eventType",
              "txnId",
              "txnIndex",
              "eventIndex",
              "maker",
              "pairId",
              "reserves",
            ],
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { fromBlock, toBlock } = request.query;
      const sqlQuery = sqlQueries.dexscreenerEvents({ fromBlock, toBlock });

      let cacheSetting = { ...CACHE_SETTINGS["dexscreenerV1Events"] };
      cacheSetting.key = `${cacheSetting.key}_${fromBlock}_${toBlock}`;

      const result = await cachedFetch(
        fastify.pg,
        fastify.redis,
        cacheSetting,
        sqlQuery
      );

      const formattedResult = JSON.parse(result).map((event) => {
        const commonFields = {
          block: {
            blockNumber: event.blocknumber,
            blockTimestamp: event.blocktimestamp,
          },
          eventType: "swap", // Default eventType for swap and sell
          txnId: event.txnid,
          txnIndex: event.txnindex,
          eventIndex: event.eventindex,
          maker: event.maker,
          pairId: event.pairid,
          reserves: {
            asset0: event.reservesasset0,
            asset1: event.reservesasset1,
          },
        };

        if (event.eventtype === "swap" || event.eventtype === "buy") {
          return {
            ...commonFields,
            asset0In: event.amount0,
            asset1Out: event.amount1,
            priceNative: event.pricenative,
          };
        } else if (event.eventtype === "sell") {
          return {
            ...commonFields,
            asset0Out: event.amount0, // indicate sell
            asset1In: event.amount1, // indicate sell
            priceNative: event.pricenative,
          };
        } else if (event.eventtype === "join" || event.eventtype === "exit") {
          return {
            ...commonFields,
            eventType: event.eventtype,
            amount0: event.amount0,
            amount1: event.amount1,
          };
        } else {
          return {
            ...commonFields,
            eventType: event.eventtype,
          };
        }
      });

      const customJsonStringify = (data, replacer = null, space = null) => {
        return JSON.stringify(
          data,
          (key, value) => {
            if (typeof value === "number") {
              return value
                .toFixed(20)
                .replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, "$1");
            }
            return value;
          },
          space
        );
      };

      const responseString = customJsonStringify(formattedResult);

      reply.header("Content-Type", "application/json").send(responseString);
    },
  });
};
