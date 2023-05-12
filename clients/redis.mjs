import { createClient } from "redis";
import { redisUri } from "../variables.mjs";

async function newRedisClient() {
  const client = createClient({
    url: redisUri(),
  });
  client.on("error", (err) => console.log("Redis Client Error", err));

  await client.connect();

  return client;
}

export { newRedisClient };
