export default async (fastify, opts) => {
  fastify.route({
    url: "/sql",
    method: ["GET"],
    schema: {
      description: "SQL health check, returns block height",
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
      const { rows } = await fastify.pg.query(
        "SELECT height FROM public.block ORDER BY id DESC LIMIT 1"
      );
      response.send({ block_height: rows[0]["height"] });
    },
  });
};
