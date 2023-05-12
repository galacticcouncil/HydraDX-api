import { createClient } from "redis";

const redisUri = () => {
  if (process.env.ENV_VARIABLE) {
    return process.env.ENV_VARIABLE;
  } else {
    return "redis://127.0.0.1:6379";
  }
};

async function newRedisClient() {
  const client = createClient({
    url: redisUri(),
  });
  client.on("error", (err) => console.log("Redis Client Error", err));

  await client.connect();

  return client;
}

export { newRedisClient };
