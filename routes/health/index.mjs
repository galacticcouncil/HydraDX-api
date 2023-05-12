import { newRedisClient } from "../../clients/redis.mjs";
import { newRpcClient } from "../../clients/rpc.mjs";

export default async (fastify, opts) => {
  fastify.get(
    "/",
    {
      schema: {
        description: "API health check",
        tags: ["health"],
        response: {
          200: {
            description: "Success Response",
            type: "object",
            properties: {
              alive: { type: "boolean" },
            },
          },
        },
      },
    },
    (request, reply) => {
      reply.send({ alive: true });
    }
  );

  fastify.get(
    "/rpc",
    {
      schema: {
        description: "RPC health check",
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              block_height: { type: "number" },
            },
          },
        },
      },
    },
    async (_, response) => {
      const rpcClient = await newRpcClient();
      const { block } = await rpcClient.rpc.chain.getBlock();

      response.send({ block_height: block.header.number.toNumber() });
    }
  );

  fastify.get(
    "/set_redis",
    {
      schema: {
        description: "Cached RPC data health check",
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              done: { type: "boolean" },
            },
          },
        },
      },
    },
    async (_, response) => {
      const redis = await newRedisClient();
      const payload = JSON.stringify({ block_height: Date() });
      await redis.set("dgd", payload);

      response.send(JSON.stringify({ done: true }));
    }
  );

  fastify.get(
    "/read_redis",
    {
      schema: {
        description: "Cached RPC data health check",
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              block_height: { type: "string" },
            },
          },
        },
      },
    },
    async (_, response) => {
      const redis = await newRedisClient();
      let payload = await redis.get("dgd");

      response.send(JSON.parse(payload));
    }
  );

  fastify.get(
    "/cache_rpc",
    {
      schema: {
        description: "Cached RPC data health check",
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              block_height: { type: "number" },
            },
          },
        },
      },
    },
    async (_, response) => {
      const redis = await newRedisClient();
      let payload = await redis.get("cache_rpc_block_height");

      response.send(JSON.parse(payload));
    }
  );

  fastify.get(
    "/sql",
    {
      schema: {
        description: "SQL health check",
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              block_height: { type: "number" },
            },
          },
        },
      },
    },
    async (request, response) => {
      const { rows } = await fastify.pg.query(
        "SELECT height FROM public.block ORDER BY id DESC LIMIT 1"
      );
      response.send({ block_height: rows[0]["height"] });
    }
  );
};
