export default async (fastify, opts) => {
  fastify.route({
    url: "/app",
    method: ["GET"],
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
    handler: async (_, response) => response.send({ alive: true }),
  });
};
