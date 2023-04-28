'use strict'

const path = require('path')
const AutoLoad = require('@fastify/autoload')
const Bree = require('bree');

// Pass --options via CLI arguments in command to enable these options.
module.exports.options = {}

module.exports = async function (fastify, opts) {
  // Place here your custom code!

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })

  // Connect to indexer DB
  fastify.register(require('@fastify/postgres'), {
    connectionString: 'postgres://reader:reader@localhost/ingest'
  })

  // Start processing scheduled jobs
  const bree = new Bree({
    jobs: [
      {
        name: 'cache_rpc_last_block',
        interval: '6s'
      }
    ]
  });

  (async () => {
    await bree.start();
  })();
}
