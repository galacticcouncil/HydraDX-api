const { createClient } = require("redis");

async function newRedisClient() {
  const client = createClient({
    // url: 'redis://127.0.0.1:6379'
    url: 'redis://10.130.48.5:6379'
  });
  client.on('error', err => console.log('Redis Client Error', err));

  await client.connect();

  return client
}

module.exports.newRedisClient = newRedisClient;
