'use strict'

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
