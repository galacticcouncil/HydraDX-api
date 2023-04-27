'use strict'

// Read the .env file.
require('dotenv').config()

// Require the framework
const Fastify = require('fastify')

function build() {
  const fastify = Fastify({ trustProxy: true })

  // Register your application as a normal plugin.
  const appService = require('./app.js')
  fastify.register(appService)
  return fastify
}

async function start() {
  // Google Cloud Run will set this environment variable for you, so
  // you can also use it to detect if you are running in Cloud Run
  const IS_GOOGLE_CLOUD_RUN = process.env.K_SERVICE !== undefined
  const IS_DOCKER_RUN = process.env.DOCKER_RUN !== undefined

  // You must listen on the port Cloud Run provides
  const port = process.env.PORT || 3000

  // You must listen on all IPV4 addresses in Cloud Run
  const host = IS_DOCKER_RUN || IS_GOOGLE_CLOUD_RUN ? "0.0.0.0" : "127.0.0.1"

  try {
    const server = build()
    const address = await server.listen({ port, host })
    console.log(`Listening on ${address}`)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

module.exports = build

if (require.main === module) {
  start()
}
