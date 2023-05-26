import { newRpcClient } from "../../../clients/rpc.mjs";

export default async (fastify, opts) => {
  fastify.route({
    url: "/rpc",
    method: ["GET"],
    schema: {
      description: "RPC health check, returns block height",
      tags: ["health"],
      response: {
        200: {
          description: "Success Response",
          type: "object",
          properties: {
            block_height: { type: "number" },
          },
        },
      },
    },
    handler: async (_, response) => {
      const rpcClient = await newRpcClient();
      const { block } = await rpcClient.rpc.chain.getBlock();

      response.send({ block_height: block.header.number.toNumber() });
    },
  });
};
