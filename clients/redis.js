const { createClient } = require("redis");

async function newRedisClient() {
  const client = createClient();
  client.on('error', err => console.log('Redis Client Error', err));

  await client.connect();

  return client
}

module.exports.newRedisClient = newRedisClient;
