const { createClient } = require("redis");

async function newRedisClient() {
  const client = createClient('10.130.48.5', 6380);
  client.on('error', err => console.log('Redis Client Error', err));

  await client.connect();

  return client
}

module.exports.newRedisClient = newRedisClient;
