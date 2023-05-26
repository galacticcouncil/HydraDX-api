import Fastify from "fastify";
import appService from "./app.mjs";
import { IS_DOCKER_RUN, IS_GOOGLE_CLOUD_RUN } from "../variables.mjs";

function build() {
  const fastify = Fastify({ trustProxy: true });

  // Register your application as a normal plugin.
  fastify.register(appService);
  return fastify;
}

async function start() {
  // You must listen on the port Cloud Run provides
  const port = process.env.PORT || 3000;

  // You must listen on all IPV4 addresses in Cloud Run
  const host = IS_DOCKER_RUN || IS_GOOGLE_CLOUD_RUN ? "0.0.0.0" : "127.0.0.1";

  try {
    const server = build();
    const address = await server.listen({ port, host });
    console.log(`Listening on ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

export default build;

start();
