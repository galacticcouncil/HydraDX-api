import path from "path";
import { dirname, redisUri } from "./variables.mjs";
import AutoLoad from "@fastify/autoload";
import cors from "@fastify/cors";
import Redis from "@fastify/redis";
import Swagger from "@fastify/swagger";
import SwaggerUi from "@fastify/swagger-ui";

// Pass --options via CLI arguments in command to enable these options.
export var options = {};

export default async (fastify, opts) => {
  // Place here your custom code!

  // Add Swagger for docs
  fastify.register(Swagger, {});
  fastify.register(SwaggerUi, {
    routePrefix: "/docs",
    theme: {
      title: "HydraDX API Docs",
    },
  });

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(dirname(), "app/plugins"),
    options: Object.assign({}, opts),
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(dirname(), "app/routes"),
    options: Object.assign({}, opts),
  });

  fastify.register(Redis, {
    url: redisUri(),
  });

  fastify.register(cors, {
    allowedHeaders: "*",
  });
};
