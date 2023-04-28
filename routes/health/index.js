'use strict'
const {newRedisClient} = require('../../clients/redis');
const {newRpcClient} = require('../../clients/rpc');

module.exports = async function (fastify, opts) {
    fastify.get('/', {
        schema: {
            description: 'API health check',
            tags: ['health'],
            response: {
                200: {
                    description: 'Success Response',
                    type: 'object',
                    properties: {
                        alive: { type: 'boolean' }
                    }
                }
            }
        }
    }, (request, reply) => {
        reply.send({ alive: true })
    })

    fastify.get('/rpc', {
      schema: {
          description: 'RPC health check',
          tags: ['health'],
          response: {
              200: {
                  type: 'object',
                  properties: {
                      block_height: { type: 'number' }
                  }
              }
          }
      }
    }, async function (_, response) {
      const rpcClient = await newRpcClient();
      const {block} = await rpcClient.rpc.chain.getBlock();

      response.send({ block_height: block.header.number.toNumber() })
    })

    fastify.get('/cache_rpc', {
        schema: {
            description: 'Cached RPC data health check',
            tags: ['health'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        block_height: { type: 'number' }
                    }
                }
            }
        }
      }, async function (_, response) {
        const redis = await newRedisClient();
        let payload = await redis.get("cache_rpc_block_height");
  
        response.send(JSON.parse(payload))
      })

    fastify.get('/sql', {
      schema: {
          description: 'SQL health check',
          tags: ['health'],
          response: {
              200: {
                  type: 'object',
                  properties: {
                      block_height: { type: 'number' }
                  }
              }
          }
      }
    }, async function (request, response) {
      const {rows} = await fastify.pg.query(
        'SELECT height FROM public.block ORDER BY id DESC LIMIT 1'
      )
      response.send({ block_height: rows[0]['height'] })
    })
}
