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
    url: "/events/:fromBlock-:toBlock",
    method: ["GET"],
    schema: {
      description: "Events info",
      tags: ["dexscreener/v1"],
      params: {
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
              "asset0In",
              "asset1Out",
              "priceNative",
              "reserves",
            ],
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { fromBlock, toBlock } = request.params;
      const sqlQuery = sqlQueries.dexscreenerEvents({ fromBlock, toBlock });

      let cacheSetting = { ...CACHE_SETTINGS["dexscreenerV1Events"] };
      cacheSetting.key = `${cacheSetting.key}_${fromBlock}_${toBlock}`;

      const result = await cachedFetch(
        fastify.pg,
        fastify.redis,
        cacheSetting,
        sqlQuery
      );

      const formattedResult = JSON.parse(result).map((event) => ({
        block: {
          blockNumber: event.blocknumber,
          blockTimestamp: event.blocktimestamp,
        },
        eventType: event.eventtype,
        txnId: event.txnid,
        txnIndex: event.txnindex,
        eventIndex: event.eventindex,
        maker: event.maker,
        pairId: event.pairid,
        asset0In: parseFloat(event.asset0in),
        asset1Out: parseFloat(event.asset1out),
        priceNative: parseFloat(event.pricenative),
        reserves: {
          asset0: parseFloat(event.reservesasset0),
          asset1: parseFloat(event.reservesasset1),
        },
      }));

      reply.send(formattedResult);
    },
  });
};
